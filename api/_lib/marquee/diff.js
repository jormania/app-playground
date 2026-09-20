// The server's copy of the diff — deliberately a duplicate of
// src/marquee/changes.js's `diff`/`toSnapshot`/`sortChanges`/`summarize`, not an
// import across the api/src boundary. That boundary is already crossed
// on purpose elsewhere (the adapter registry: "these ids are the contract
// between the two halves — change one, change both") rather than by reaching
// into the Vite source tree from a serverless function, which nothing else here
// does and which this file doesn't want to be the first exception to.
//
// This is the piece that makes the scheduled check (api/_lib/marquee/serverScan.js)
// possible without inventing a second definition of "what counts as a change" —
// src/marquee/changes.js's own header already anticipated this move: "written to
// be callable from either side, so moving it into a cron later is a small change."
// If the rule ever changes, change it in BOTH files — src/marquee/changes.test.js
// and this file's own tests both exercise the same cases so a drift shows up as a
// test failure, not a silent behavioural difference between the app and the email.

export const CHANGE = {
  NEW: 'new-event',
  RETURNED: 'returned',
  TICKETS_OPENED: 'tickets-opened',
  SOLD_OUT: 'sold-out',
  CANCELLED: 'cancelled',
}

/** venue + title, folded — the identity of a production across its dates. The
 *  client's copy lives in src/marquee/programme.js; same rule, same string. */
function productionId(event) {
  return `${event.venue}::${event.title}`.toLowerCase()
}

export function toSnapshot(events, scannedAt) {
  const map = {}
  for (const e of events ?? []) {
    map[e.key] = {
      ticketState: e.ticketState, date: e.date, title: e.title, venue: e.venue, time: e.time ?? null,
      // So the evening email can qualify a return the same way the app does
      // (§9.68): "tickets on sale — 1 seat left".
      seatsLeft: e.seatsLeft ?? null,
      // What a watch is held on — see `diff` below.
      production: productionId(e),
    }
  }
  return { scannedAt: scannedAt ?? new Date().toISOString(), events: map }
}

/**
 * Keep what we last knew about every venue this run got no answer from.
 *
 * The snapshot is "the programme as of the last scheduled check", and a venue
 * that was skipped, throttled or unreachable contributes nothing to this run's
 * events — so storing this run's events raw would record its whole programme as
 * having ceased to exist. `diff` already refuses to call that a cancellation
 * (`answeredVenues` gates the second loop), but the hole persists into the
 * STORED snapshot, and the next check that does reach the venue then reports
 * every one of its twenty showings as brand new. One unreachable night, one
 * junk email.
 *
 * Nobody noticed on this side because until §9.89 a truncated run died before
 * `kvSet` and so left the previous snapshot intact by accident. A run that now
 * ends gracefully mid-list has to do on purpose what the crash was doing for
 * free: carry those venues' entries through untouched — same ticketState, so no
 * phantom "tickets on sale" either — until the venue answers for itself again.
 *
 * The third implementation of one rule, and the last of the three to get it:
 * `src/marquee/scanClient.js` does it inline for the app's own snapshot and
 * `src/marquee/notify.js`'s `nextSnapshot` does it for the notification
 * snapshot. (notify.js's header asserted the server already did too — it did
 * not, which is how a comment ends up being the only place a rule is
 * implemented.) Change the rule and change all three.
 */
export function carryUnanswered(previous, current) {
  const answered = new Set(current?.answeredVenues ?? [])
  const events = { ...(current?.events ?? {}) }
  for (const [key, event] of Object.entries(previous?.events ?? {})) {
    if (events[key] || answered.has(event.venue)) continue
    events[key] = event
  }
  return { ...current, events }
}

export function diff(previous, current, { now = new Date(), watching = null } = {}) {
  const before = previous?.events ?? null
  const after = current?.events ?? {}
  if (!before) return { hadSnapshot: false, changes: [] }

  const changes = []
  const todayKey = now.toISOString().slice(0, 10)

  // Kept identical to the client's rule (§9.63), including the branch this
  // side can never take: a watchlist lives in the browser that formed it, so
  // `watching` is always empty here and the scheduled check reports a return
  // as the `new-event` or `tickets-opened` it also is. The parameter exists so
  // the two copies stay the same function rather than diverging quietly — the
  // one thing this file's header asks for.
  const watched = watching instanceof Set ? watching : new Set(watching ?? [])
  const isWatched = (event) => watched.size > 0 && event.production && watched.has(event.production)

  for (const [key, event] of Object.entries(after)) {
    const was = before[key]
    if (!was) {
      changes.push({ kind: isWatched(event) ? CHANGE.RETURNED : CHANGE.NEW, key, ...event })
      continue
    }
    if (was.ticketState !== 'open' && event.ticketState === 'open') {
      changes.push({ kind: isWatched(event) ? CHANGE.RETURNED : CHANGE.TICKETS_OPENED, key, ...event })
    } else if (was.ticketState !== 'sold-out' && event.ticketState === 'sold-out') {
      changes.push({ kind: CHANGE.SOLD_OUT, key, ...event })
    }
  }

  const answered = new Set(current?.answeredVenues ?? [])
  for (const [key, event] of Object.entries(before)) {
    if (after[key]) continue
    if (event.date && event.date < todayKey) continue
    if (!answered.has(event.venue)) continue
    changes.push({ kind: CHANGE.CANCELLED, key, ...event })
  }

  return { hadSnapshot: true, changes: sortChanges(changes) }
}

const ORDER = [CHANGE.RETURNED, CHANGE.TICKETS_OPENED, CHANGE.CANCELLED, CHANGE.SOLD_OUT, CHANGE.NEW]

export function sortChanges(changes) {
  return [...changes].sort((a, b) => {
    const byKind = ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
    if (byKind) return byKind
    return String(a.date).localeCompare(String(b.date))
  })
}

export const CHANGE_LABEL = {
  [CHANGE.NEW]: 'new',
  [CHANGE.RETURNED]: 'back — you were watching this',
  [CHANGE.TICKETS_OPENED]: 'tickets on sale',
  [CHANGE.SOLD_OUT]: 'sold out',
  [CHANGE.CANCELLED]: 'gone from the programme',
}

export function summarize(result) {
  if (!result) return ''
  if (result.status !== 'ok' && result.status !== 'empty') return result.detail || result.status
  // Read fine despite the site's own status line saying otherwise (§9.61) —
  // recorded here so a venue serving its programme under an HTTP 500 shows up
  // in its own Last Result instead of looking perfectly healthy.
  const served = result.servedStatus ? ` · served under HTTP ${result.servedStatus}` : ''
  const n = result.events.length
  if (n === 0) return `nothing upcoming${served}`
  const soldOut = result.events.filter((e) => e.ticketState === 'sold-out').length
  return `${n} event${n === 1 ? '' : 's'}${soldOut ? ` · ${soldOut} sold out` : ''}${served}`
}
