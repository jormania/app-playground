// The diff — the part of Marquee that is actually the product.
//
// A programme page is a fact anyone can read. What Marquee adds is *what changed
// since you last looked*: a show that wasn't there, tickets that just went on
// sale, a night that just sold out. Everything else in the app is furniture around
// this function.
//
// v1 keeps no server state (MARQUEE.md §7): the client holds a snapshot of the
// last scan in localStorage and diffs the new one against it. `diff` is written to
// be callable from either side, so moving it into a cron later is a small change.
//
// Pure — no fetch, no storage, no React.

export const CHANGE = {
  NEW: 'new-event',
  TICKETS_OPENED: 'tickets-opened',
  SOLD_OUT: 'sold-out',
  CANCELLED: 'cancelled',
}

/** A snapshot is `{ scannedAt, events: { [key]: {ticketState, date, title, venue} } }`
 *  — small enough for localStorage on purpose. Only what the diff needs is kept;
 *  the full events come back with each scan anyway. */
export function toSnapshot(events, scannedAt) {
  const map = {}
  for (const e of events ?? []) {
    map[e.key] = { ticketState: e.ticketState, date: e.date, title: e.title, venue: e.venue, time: e.time ?? null }
  }
  return { scannedAt: scannedAt ?? new Date().toISOString(), events: map }
}

/**
 * What changed between two scans.
 *
 * Two rules keep this honest:
 *
 * 1. **A first-ever scan produces no changes.** With no snapshot, every event on
 *    every page is technically "new", and reporting 200 new events tells you
 *    nothing. The first scan establishes the baseline silently; the second one
 *    starts being useful. `hadSnapshot: false` says so out loud.
 *
 * 2. **`cancelled` is only claimed for a venue that actually answered.** A venue
 *    that was throttled, unreachable or parser-broken contributes NO events, and
 *    treating its absent events as cancellations would empty the app every time a
 *    site hiccuped. Absence is only meaningful from a venue we truly read.
 */
export function diff(previous, current, { now = new Date() } = {}) {
  const before = previous?.events ?? null
  const after = current?.events ?? {}
  if (!before) return { hadSnapshot: false, changes: [] }

  const changes = []
  const todayKey = now.toISOString().slice(0, 10)

  for (const [key, event] of Object.entries(after)) {
    const was = before[key]
    if (!was) {
      changes.push({ kind: CHANGE.NEW, key, ...event })
      continue
    }
    if (was.ticketState !== 'open' && event.ticketState === 'open') {
      changes.push({ kind: CHANGE.TICKETS_OPENED, key, ...event })
    } else if (was.ticketState !== 'sold-out' && event.ticketState === 'sold-out') {
      changes.push({ kind: CHANGE.SOLD_OUT, key, ...event })
    }
  }

  const answered = new Set(current?.answeredVenues ?? [])
  for (const [key, event] of Object.entries(before)) {
    if (after[key]) continue
    if (event.date && event.date < todayKey) continue // it simply happened
    if (!answered.has(event.venue)) continue          // see rule 2
    changes.push({ kind: CHANGE.CANCELLED, key, ...event })
  }

  return { hadSnapshot: true, changes: sortChanges(changes) }
}

/** Most useful first: tickets opening is the thing worth acting on today; a
 *  cancellation is worth knowing; a new listing is the background hum. Within a
 *  kind, soonest event first. */
const ORDER = [CHANGE.TICKETS_OPENED, CHANGE.CANCELLED, CHANGE.SOLD_OUT, CHANGE.NEW]

export function sortChanges(changes) {
  return [...changes].sort((a, b) => {
    const byKind = ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
    if (byKind) return byKind
    return String(a.date).localeCompare(String(b.date))
  })
}

export const CHANGE_LABEL = {
  [CHANGE.NEW]: 'new',
  [CHANGE.TICKETS_OPENED]: 'tickets on sale',
  [CHANGE.SOLD_OUT]: 'sold out',
  [CHANGE.CANCELLED]: 'gone from the programme',
}

/** One line summarising a scan, for the venue row and for Notion's Last Result. */
export function summarize(result) {
  if (!result) return ''
  if (result.status !== 'ok' && result.status !== 'empty') return result.detail || result.status
  const n = result.events.length
  if (n === 0) return 'nothing upcoming'
  const soldOut = result.events.filter((e) => e.ticketState === 'sold-out').length
  return `${n} event${n === 1 ? '' : 's'}${soldOut ? ` · ${soldOut} sold out` : ''}`
}
