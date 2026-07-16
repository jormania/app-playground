// Pure triage over items: text search (scoped), a status segment, two independent
// yes/no flags, and sort order. The query is tokenised on whitespace and every token
// must match somewhere in scope (AND), case-insensitively. Empty query returns
// everything. Kept pure and separate from React so it's cheap to test.
import { daysUntil, todayKey } from './dates.js'

export const SCOPES = [
  { value: 'all', label: 'all' },
  { value: 'text', label: 'text' },
  { value: 'category', label: 'category' },
  { value: 'place', label: 'place' },
  { value: 'tags', label: 'tags' },
]

// Status segment for the backlog — mutually exclusive, exactly one active at a time.
// "Backlog" is everything not yet attended — the whole active pile, including ideas.
// "Ideas" is a SUBSET of it: the loose someday things with neither a Planned Date nor a
// Date Expiring, so they never surface on the calendar and are easy to forget; that filter
// keeps a closer eye on them. (`value: 'todo'` is kept for the Backlog option so a
// previously-persisted view pref still resolves — only the label changed.)
export const STATUSES = [
  { value: 'todo', label: 'Backlog' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'attended', label: 'Attended' },
  { value: 'all', label: 'All' },
]

// Independent flags, layered on top of Status (ANDed, not mutually exclusive with it or
// each other) — narrowing filters rather than a different view of the backlog. "Going
// only" answers "what am I actually committed to, ignore the rest of the pile right now";
// "Has tickets" answers "what do I already hold proof for", handy right before a trip.
// Both default off so the list shows everything Status already implies, same as before
// these existed.
export const FLAGS = [
  { key: 'goingOnly', label: 'Going only' },
  { key: 'ticketsOnly', label: 'Has tickets' },
]

// Shared predicate for "an idea": unattended, with no planned date and no expiry — a thing
// you mean to get to someday but haven't pinned to any date. Reused by the Ideas filter
// here and the server-side stale-idea email nudge (kept in step by intent, not by import —
// the cron can't reach into the Vite tree).
export function isIdea(entry) {
  return Boolean(entry) && !entry.attended && !entry.plannedDate && !entry.dateExpiring
}

// Sort order — exactly one active at a time, since a list only has one arrangement.
// "Expiring first" (default) answers "what's about to close"; "Planned first" answers
// "what's dated soonest, decided or not"; "Going first" answers "what have I actually
// committed to" without hiding anything the way the Going-only flag does. Deliberately
// kept as three separate, single-purpose date sorts rather than one that blends Going
// priority into Planned order — each answers one question, and combining Going-only *plus*
// Planned-first sort already covers the "just my confirmed plans, soonest first" case.
export const SORTS = [
  { value: 'expiring', label: 'Expiring first' },
  { value: 'planned', label: 'Planned first' },
  { value: 'going', label: 'Going first' },
  { value: 'added', label: 'Recently added' },
  { value: 'az', label: 'A–Z' },
]

function haystack(entry, scope) {
  const parts = []
  if (scope === 'all' || scope === 'text') parts.push(entry.name || '', entry.description || '')
  if (scope === 'all' || scope === 'category') parts.push(entry.category || '')
  if (scope === 'all' || scope === 'place') parts.push(entry.place || '')
  if (scope === 'all' || scope === 'tags') parts.push((entry.tags || []).join(' '))
  return parts.join('  ').toLowerCase() // double-space keeps tokens from spanning fields
}

export function filterBySearch(entries, query, scope = 'all') {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return entries || []
  return (entries || []).filter(e => {
    const hay = haystack(e, scope)
    return tokens.every(t => hay.includes(t))
  })
}

export function filterByStatus(entries, status = 'todo') {
  if (status === 'all') return entries || []
  if (status === 'ideas') return (entries || []).filter(isIdea)
  const attended = status === 'attended'
  return (entries || []).filter(e => Boolean(e?.attended) === attended)
}

// The two independent flags, ANDed together and with whatever Status already narrowed to.
// Both off (the default) is a no-op — existing behaviour, unchanged.
export function filterByFlags(entries, { goingOnly = false, ticketsOnly = false } = {}) {
  let list = entries || []
  if (goingOnly) list = list.filter(e => Boolean(e?.going))
  if (ticketsOnly) list = list.filter(e => (e?.tickets?.length || 0) > 0)
  return list
}

// Sort a copy of the list.
// "Expiring first": soonest real deadline at the top, items with no deadline after them
// (by recency), and — within either group — unattended before attended so checked-off
// things sink. A missing dateExpiring sorts as +∞ so it never jumps ahead of a dated item.
// Tiers: a future/today deadline ranks by days-away (soonest first); no deadline sits in
// the middle; an already-expired, still-unattended item sinks into a tier of its own at the
// very bottom (most-recently-expired first) — see the "past" divider in ListView, which
// renders right where this tier begins. Attended items never carry expiry weight, since the
// deadline no longer matters once you've gone.
const NO_EXPIRY_RANK = 1e9
const PAST_RANK_BASE = 2e9
// "Planned first": the same shape as Expiring, just keyed on Planned Date instead, and
// blind to Going — a dated-but-undecided entry and a Going-confirmed one on the same day
// rank equally; only the date matters.
const NO_PLANNED_RANK = 1e9
const PAST_PLANNED_RANK_BASE = 2e9
// "Going first": Going-confirmed entries rank first (soonest first), then everyone else
// with a Planned Date (soonest first) — a fixed offset keeps every Going entry ahead of
// every non-Going one regardless of how their dates compare, since the point of this sort
// is surfacing commitments first, not blending them into plain date order (that's what
// Planned-first is for). A past Planned Date that's still unattended sinks into its own
// bottom tier, most-recently-passed first, mirroring expRank's past-due tier; no Planned
// Date (or an attended entry) sits in the plain middle.
const GOING_RANK_OFFSET = 1e6
const NO_GOING_RANK = 1e9
const PAST_GOING_RANK_BASE = 2e9
export function sortEntries(entries, sort = 'expiring', today = todayKey()) {
  const list = [...(entries || [])]
  const addedRank = (e) => e?.dateAdded || ''
  const expRank = (e) => {
    if (!e?.dateExpiring || e.attended) return NO_EXPIRY_RANK
    const n = daysUntil(e.dateExpiring, today)
    if (n == null) return NO_EXPIRY_RANK
    return n < 0 ? PAST_RANK_BASE - n : n
  }
  const plannedRank = (e) => {
    if (!e?.plannedDate || e.attended) return NO_PLANNED_RANK
    const n = daysUntil(e.plannedDate, today)
    if (n == null) return NO_PLANNED_RANK
    return n < 0 ? PAST_PLANNED_RANK_BASE - n : n
  }
  const goingRank = (e) => {
    if (!e?.plannedDate || e.attended) return NO_GOING_RANK
    const n = daysUntil(e.plannedDate, today)
    if (n == null) return NO_GOING_RANK
    if (n < 0) return PAST_GOING_RANK_BASE - n
    return e.going ? n : GOING_RANK_OFFSET + n
  }
  const byRank = (rankFn) => (a, b) => {
    const ra = rankFn(a), rb = rankFn(b)
    if (ra !== rb) return ra - rb
    // tie-break: newer additions first, then name
    const added = String(addedRank(b)).localeCompare(String(addedRank(a)))
    return added !== 0 ? added : String(a?.name || '').localeCompare(String(b?.name || ''))
  }
  if (sort === 'az') {
    list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
  } else if (sort === 'added') {
    list.sort((a, b) => String(addedRank(b)).localeCompare(String(addedRank(a))))
  } else if (sort === 'planned') {
    list.sort(byRank(plannedRank))
  } else if (sort === 'going') {
    list.sort(byRank(goingRank))
  } else {
    list.sort(byRank(expRank))
  }
  return list
}

// The full pipeline used by the list: status → flags → search → sort. Kept as one call so
// the view and the tests exercise the same order of operations.
export function triage(entries, { status = 'todo', query = '', scope = 'all', sort = 'expiring', today = todayKey(), goingOnly = false, ticketsOnly = false } = {}) {
  return sortEntries(filterBySearch(filterByFlags(filterByStatus(entries, status), { goingOnly, ticketsOnly }), query, scope), sort, today)
}
