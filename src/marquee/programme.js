// Turning a flat list of showings into something worth reading.
//
// A cinema lists the same film six times and a theatre runs one production across
// a fortnight; rendering that as thirty rows is a worse version of the venue's own
// page. Marquee groups by PRODUCTION — venue + title — and nests the dates under
// it, which is also the unit you actually decide about ("do I want to see this?"
// long before "which night?").
//
// Pure — no React, no storage.

import { isActive } from './venues.js'
import { fold } from './findings.js'

/** Free-text search across title and venue, diacritics and case folded through
 *  the same `fold` the dedupe matcher uses — "sperante" finds "speranțe". A
 *  blank query returns everything unfiltered rather than nothing, so an empty
 *  search box behaves like no search box at all. */
export function searchProductions(productions, query) {
  const q = fold(query)
  if (!q) return productions
  return productions.filter((p) => fold(p.title).includes(q) || fold(p.venue).includes(q))
}

// Saved is deliberately absent: it is not the app's to remember (see findings.js).
export const TRIAGE = { IGNORED: 'ignored' }

/** venue + title, folded — the identity of a production across its dates. */
export function productionId(event) {
  return `${event.venue}::${event.title}`.toLowerCase()
}

/** A production id, as a DOM id a "What changed" row can scroll to. Reuses
 *  findings.js's diacritic fold — `productionId` itself only lowercases, so
 *  "speranțe" would otherwise collapse to a run of hyphens instead of folding
 *  to "sperante" — and a clean id is also a valid CSS selector, which the
 *  flash-highlight styling wants to be able to target directly. */
export function domIdFor(id) {
  return `prod-${fold(id).replace(/\s+/g, '-')}`
}

/** Drop today's showings whose start time has already passed.
 *
 *  A scan keeps the whole of today (dropping it server-side would make "nothing on"
 *  depend on the hour a check happened to run), so the decision of whether a 19:00
 *  concert is still worth showing at 19:30 belongs here, to a preference.
 *  Undated-time showings always survive — a cinema that prints no time might mean
 *  anything, and guessing would hide a real option. */
export function dropStarted(events, { now = new Date(), keep = false } = {}) {
  if (keep) return events ?? []
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return (events ?? []).filter((e) => !(e.date === today && e.time && e.time < clock))
}

/** Group showings into productions, preserving date order within each and
 *  ordering productions by their soonest showing. */
export function toProductions(events) {
  const byId = new Map()
  for (const event of events ?? []) {
    const id = productionId(event)
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title: event.title,
        venue: event.venue,
        hall: event.hall ?? null,
        image: event.image ?? null,
        link: event.link ?? null,
        showings: [],
      })
    }
    const production = byId.get(id)
    production.showings.push(event)
    // Fill in details from whichever showing happens to carry them.
    production.image ??= event.image ?? null
    production.link ??= event.link ?? null
    production.hall ??= event.hall ?? null
  }

  const out = [...byId.values()]
  for (const p of out) {
    p.showings.sort((a, b) => (a.date === b.date
      ? String(a.time ?? '').localeCompare(String(b.time ?? ''))
      : a.date.localeCompare(b.date)))
    p.firstDate = p.showings[0]?.date ?? null
    p.lastDate = p.showings[p.showings.length - 1]?.date ?? null
    // A production counts as buyable if ANY of its showings is: "sold out" should
    // mean the whole run is gone, not that one night is.
    p.anyOpen = p.showings.some((s) => s.ticketState === 'open')
    p.allSoldOut = p.showings.length > 0 && p.showings.every((s) => s.ticketState === 'sold-out')
    p.price = p.showings.find((s) => s.price != null)?.price ?? null
  }
  return out.sort((a, b) => String(a.firstDate).localeCompare(String(b.firstDate)) || a.title.localeCompare(b.title, 'ro'))
}

/** A lookup from event key → what changed about it this scan, so a card can
 *  mark the specific showing (and itself) without every consumer re-walking
 *  `scan.changes`. Only `changes`, not the whole scan object, so a caller with
 *  no scan yet can pass `[]` rather than something conditional. */
export function changedKeyMap(changes) {
  const map = new Map()
  for (const c of changes ?? []) map.set(c.key, c.kind)
  return map
}

/** Most useful first — same priority `changes.js`'s own CHANGE ORDER uses for
 *  the "what changed" strip, so a card showing more than one kind of change
 *  (a run where one date opened and another sold out) leads with the one
 *  worth acting on. `cancelled` never appears here: by the time a card is
 *  rendered its showing still exists in THIS scan, so nothing on it can be the
 *  one that vanished. */
const CARD_CHANGE_ORDER = ['tickets-opened', 'sold-out', 'new-event']

export function primaryChangeKind(production, changedKeys) {
  let best = null
  for (const showing of production.showings) {
    const kind = changedKeys.get(showing.key)
    if (!kind) continue
    if (!best || CARD_CHANGE_ORDER.indexOf(kind) < CARD_CHANGE_ORDER.indexOf(best)) best = kind
  }
  return best
}

/** Group productions by their first date, for a date-led feed. */
export function byDate(productions) {
  const days = new Map()
  for (const p of productions) {
    if (!days.has(p.firstDate)) days.set(p.firstDate, [])
    days.get(p.firstDate).push(p)
  }
  return [...days.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([date, items]) => ({ date, productions: items }))
}

/** Apply the user's triage and venue filter.
 *
 *  Ignoring is per PRODUCTION and permanent, including future dates — the point of
 *  ignoring a film is never hearing about it again, not hearing about it again on
 *  Thursday. */
export function visibleProductions(productions, { triage = {}, venue = null, hideIgnored = true, hideSoldOut = false } = {}) {
  return productions.filter((p) => {
    if (venue && p.venue !== venue) return false
    if (hideIgnored && triage[p.id] === TRIAGE.IGNORED) return false
    // A run counts as sold out only when EVERY date is — hiding a production with
    // one night still on sale would hide the thing you wanted.
    if (hideSoldOut && p.allSoldOut) return false
    return true
  })
}

/** The venues a scan should ask about: active, with a reader, and (when the user
 *  has narrowed the view) not filtered out. Wraps `scannable` so the endpoint
 *  payload is built in exactly one place.
 *
 *  `category` rides along even though nothing in the UI needs it: the endpoint
 *  uses it to pick each venue's horizon (see api/_lib/marquee/scan.js's
 *  `horizonFor` — cinemas get 10 days, everything else the full 120). */
export function scanPayload(venues) {
  return (venues ?? [])
    .filter((v) => isActive(v) && v.url && v.adapter && v.adapter !== 'unsupported')
    .map((v) => ({ id: v.id, name: v.name, url: v.url, adapter: v.adapter, config: v.config ?? null, category: v.category ?? null }))
}
