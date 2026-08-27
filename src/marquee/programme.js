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

/** Human labels for `venues.js`'s CATEGORIES vocabulary, in the fixed order the
 *  category filter row renders them — same order every time regardless of how
 *  many venues happen to be in each, so the row doesn't reshuffle as venues are
 *  added or paused. */
export const CATEGORY_LABEL = {
  play: 'Theatre',
  movie: 'Cinema',
  concert: 'Concert',
  event: 'Event',
  art: 'Art',
  culture: 'Culture',
}
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)

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
        description: event.description ?? null,
        showings: [],
      })
    }
    const production = byId.get(id)
    production.showings.push(event)
    // Fill in details from whichever showing happens to carry them.
    production.image ??= event.image ?? null
    production.link ??= event.link ?? null
    production.hall ??= event.hall ?? null
    production.description ??= event.description ?? null
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

/** The day-section id a week-strip cell scrolls to — one id per calendar day,
 *  distinct from `domIdFor`'s per-PRODUCTION id (a "what changed" row jumps to
 *  one card; a week-strip cell jumps to a whole day's worth). */
export function domIdForDay(date) {
  return `day-${date}`
}

/** `count` calendar dates starting today (local, not UTC — see format.js's own
 *  `formatDay` for why the day boundary has to be computed this way rather
 *  than by adding milliseconds across a DST change). */
export function nextDayKeys(now = new Date(), count = 7) {
  const out = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}

/**
 * How many distinct PRODUCTIONS have at least one showing on each of `days`.
 *
 * Deliberately not `byDate`'s grouping (which only ever counts a production
 * on its FIRST date): a run spanning several nights should light up every one
 * of them in the strip, not only the night it opens — "am I free Thursday,
 * and is anything on?" is a question about that specific night, not about
 * which productions happen to start there.
 */
export function densityForDays(productions, days) {
  return days.map((date) => ({
    date,
    count: (productions ?? []).filter((p) => p.showings.some((s) => s.date === date)).length,
  }))
}

/** Apply the user's triage, category, venue and hall filters.
 *
 *  Ignoring is per PRODUCTION and permanent, including future dates — the point of
 *  ignoring a film is never hearing about it again, not hearing about it again on
 *  Thursday.
 *
 *  `category` and `hall` are resolved through `venueCategory` — a Map from venue
 *  name to its `Category Default` — because a production only carries its own
 *  venue's NAME, not the category, which lives on the venue row instead. A `hall`
 *  filter without a `venue` filter would mix halls across unrelated venues (Sala
 *  Mare at Ateneul next to Sala Mare at Unteatru), so it is only meaningful, and
 *  only ever applied by the UI, once a single venue is already chosen. */
export function visibleProductions(productions, { triage = {}, venue = null, category = null, hall = null, venueCategory = new Map(), hideIgnored = true, hideSoldOut = false, hideKept = false } = {}) {
  return productions.filter((p) => {
    if (venue && p.venue !== venue) return false
    if (category && venueCategory.get(p.venue) !== category) return false
    if (hall && p.hall !== hall) return false
    if (hideIgnored && triage[p.id] === TRIAGE.IGNORED) return false
    // A run counts as sold out only when EVERY date is — hiding a production with
    // one night still on sale would hide the thing you wanted.
    if (hideSoldOut && p.allSoldOut) return false
    // Same logic as sold-out: only once EVERY date of the run is already in
    // Wanderlist. A production with one night kept and others still undecided
    // is still something to see here, not clutter to hide.
    if (hideKept && p.savedAll) return false
    return true
  })
}

/** name → category, for the lookup `visibleProductions` needs — built once from
 *  the venue list rather than every production carrying its own copy. */
export function venueCategoryMap(venues) {
  return new Map((venues ?? []).map((v) => [v.name, v.category]))
}

/** Which categories are actually in play, in `CATEGORY_ORDER` — so the category
 *  filter row only ever shows options with something behind them, and never
 *  reshuffles as venues are added, paused or removed. */
export function categoriesInUse(venues) {
  const present = new Set((venues ?? []).map((v) => v.category))
  return CATEGORY_ORDER.filter((c) => present.has(c))
}

/** The distinct halls among a venue's own visible productions — the second-tier
 *  filter only makes sense, and is only ever shown, once a single venue is
 *  selected. A venue with one hall (or none named at all) yields an empty list,
 *  so the row simply doesn't render rather than showing a single, pointless chip. */
export function hallsInUse(productions, venueName) {
  const halls = new Set(
    productions.filter((p) => p.venue === venueName && p.hall).map((p) => p.hall),
  )
  return halls.size > 1 ? [...halls].sort((a, b) => a.localeCompare(b, 'ro')) : []
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
