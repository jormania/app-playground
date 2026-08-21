// The Radar-B event model — one shape for the messy reality of real-world events.
//
// Everything except `name` is allowed to be missing. An event scraped out of the
// middle of a B365 paragraph (a title and a rough date) and an event read off a
// gallery's own page (poster, exact time, ticket link, price) are the SAME shape
// here; the difference shows up as `confidence` and as which fields are null —
// never as a second record type. Rendering code must therefore treat every field
// as optional, and `signals.js`/`dates.js` are written to degrade rather than
// throw on a half-empty event.

/** Confidence ranks, high to low. Drives which source wins a field on merge, and
 *  how precisely the UI is willing to speak about an event. */
export const CONFIDENCE_RANK = { confirmed: 3, reported: 2, uncertain: 1 }

/** Wanderlist's closed Category vocabulary, reused verbatim so a save is lossless.
 *  See the wanderlist skill / WANDERLIST.md — do not extend without extending there. */
export const CATEGORIES = ['art', 'concert', 'play', 'movie', 'culture', 'event', 'venue', 'discovery', 'idea']

/** The closed signal vocabulary. Small on purpose — see RADAR_B.md §7. */
export const SIGNALS = ['recommended', 'free', 'ticketed', 'family', 'outdoor', 'new-venue', 'recurring', 'long-run', 'sold-out']

/** Where an event record came from, as a store (not as an editorial source). */
export const ORIGINS = ['radar', 'suggested', 'wanderlist']

export function emptyEvent() {
  return {
    id: null,
    key: null,
    name: '',
    start: null,
    end: null,
    hasTime: false,
    venue: null,
    address: null,
    area: null,
    category: null,
    summary: null,
    signals: [],
    cost: null,
    link: null,
    tickets: null,
    image: null,
    organizer: null,
    sources: [],
    confidence: 'reported',
    checked: null,
    origin: 'radar',
    saved: false,
  }
}

export function normalizeEvent(raw) {
  const e = { ...emptyEvent(), ...raw }
  e.name = String(e.name ?? '').trim()
  e.category = e.category ? String(e.category).trim().toLowerCase() : null
  e.signals = uniq((e.signals ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))
  e.sources = (e.sources ?? []).filter((s) => s && s.name).map(normalizeSource)
  e.confidence = CONFIDENCE_RANK[e.confidence] ? e.confidence : 'reported'
  e.cost = typeof e.cost === 'number' && Number.isFinite(e.cost) ? e.cost : null
  // A cost and a `free` signal are contradictory; the signal wins (Wanderlist's
  // own rule — a free thing never carries a price).
  if (e.signals.includes('free')) e.cost = null
  return e
}

function normalizeSource(s) {
  return {
    name: String(s.name).trim(),
    url: s.url ? String(s.url).trim() : null,
    date: s.date ? String(s.date).slice(0, 10) : null,
    // Which store this mention arrived through — lets the UI distinguish
    // "Curatorial said so" from "this is sitting in your Wanderlist".
    kind: s.kind || 'editorial',
  }
}

export function uniq(list) {
  return [...new Set(list)]
}

/** Higher = more trustworthy. Ties broken by how recently the row was checked. */
export function trustScore(event) {
  const rank = CONFIDENCE_RANK[event.confidence] ?? 1
  const checked = event.checked ? Date.parse(event.checked) : 0
  return rank * 1e13 + (Number.isFinite(checked) ? checked : 0)
}

/** True when an event carries so little that the UI should say so out loud
 *  rather than render blanks as if they were facts. */
export function isThin(event) {
  return !event.summary && !event.venue && !event.link
}
