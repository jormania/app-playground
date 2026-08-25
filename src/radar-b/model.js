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
export const SIGNALS = ['recommended', 'free', 'ticketed', 'family', 'outdoor', 'new-venue', 'recurring', 'long-run', 'sold-out', 'mainstream']

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
    // ── Identity through a merge ──────────────────────────────────────────
    // A merged event can be built from a Radar row AND a Findings row. Both ids
    // are kept because they're written to for different reasons: `radarId` is
    // where a dismissal goes, `findingsId` is the Wanderlist entry to link to.
    radarId: null,
    findingsId: null,
    // ── Wanderlist state, carried through so Radar-B can answer "what did I
    // already decide about this?" without a trip to Wanderlist ──────────────
    attended: false,
    going: false,
    plannedDate: null,
    plannedTime: null,
    dateExpiring: null,
    hasTickets: false,
    // Set by Radar-B itself, stored on the Radar row so it syncs across devices.
    dismissed: false,
    dismissedAt: null,
  }
}

export function normalizeEvent(raw) {
  const e = { ...emptyEvent(), ...raw }
  e.name = String(e.name ?? '').trim()
  e.category = e.category ? String(e.category).trim().toLowerCase() : null
  e.signals = uniq((e.signals ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))
  e.sources = (e.sources ?? []).filter((s) => s && s.name).map(normalizeSource)
  e.confidence = CONFIDENCE_RANK[e.confidence] ? e.confidence : 'reported'
  e.attended = Boolean(e.attended)
  e.going = Boolean(e.going)
  e.dismissed = Boolean(e.dismissed)
  e.hasTickets = Boolean(e.hasTickets)
  if (e.origin === 'radar') e.radarId = e.radarId ?? e.id
  if (e.origin === 'wanderlist') e.findingsId = e.findingsId ?? e.id
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

/** A Wanderlist "Idea" — the loose someday thing: not attended, no planned date
 *  and no deadline. Deliberately NOT an event, so Radar-B excludes it by default
 *  (Settings → Ce intră în Radar). Mirrors Wanderlist's own `isIdea` rule, which
 *  is the definition of record; keep the two in step. */
export function isIdea(event) {
  return event.origin === 'wanderlist'
    && !event.attended
    && !event.plannedDate
    && !event.dateExpiring
}

/** Wanderlist categories that describe a PLACE or a NOTION rather than something
 *  happening at a time — a café worth visiting, a loose tip. They're valuable in
 *  Wanderlist and meaningless in a "what's on this week" stream. */
export const NON_EVENT_CATEGORIES = ['venue', 'idea', 'discovery']

export function isNonEvent(event) {
  return NON_EVENT_CATEGORIES.includes(event.category)
}

/** True when an event carries so little that the UI should say so out loud
 *  rather than render blanks as if they were facts. */
export function isThin(event) {
  return !event.summary && !event.venue && !event.link
}
