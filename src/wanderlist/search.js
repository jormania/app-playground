// Pure triage over items: text search (scoped), a status segment, and sort order.
// The query is tokenised on whitespace and every token must match somewhere in scope
// (AND), case-insensitively. Empty query returns everything. Kept pure and separate
// from React so it's cheap to test.
import { daysUntil, todayKey } from './dates.js'

export const SCOPES = [
  { value: 'all', label: 'all' },
  { value: 'text', label: 'text' },
  { value: 'category', label: 'category' },
  { value: 'place', label: 'place' },
  { value: 'tags', label: 'tags' },
]

// Status segment for the backlog. "Backlog" is everything not yet attended — the whole
// active pile, including ideas. "Ideas" is a SUBSET of it: the loose someday things with
// neither a Planned Date nor a Date Expiring, so they never surface on the calendar and are
// easy to forget; that filter keeps a closer eye on them. (`value: 'todo'` is kept for the
// Backlog option so a previously-persisted view pref still resolves — only the label changed.)
export const STATUSES = [
  { value: 'todo', label: 'Backlog' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'attended', label: 'Attended' },
  { value: 'all', label: 'All' },
]

// Shared predicate for "an idea": unattended, with no planned date and no expiry — a thing
// you mean to get to someday but haven't pinned to any date. Reused by the Ideas filter
// here and the server-side stale-idea email nudge (kept in step by intent, not by import —
// the cron can't reach into the Vite tree).
export function isIdea(entry) {
  return Boolean(entry) && !entry.attended && !entry.plannedDate && !entry.dateExpiring
}

export const SORTS = [
  { value: 'expiring', label: 'Expiring first' },
  { value: 'planned', label: 'Going, then Planned' },
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

// Sort a copy of the list. "Expiring first" is the default: soonest real deadline at
// the top, items with no deadline after them (by recency), and — within either group —
// unattended before attended so checked-off things sink. A missing dateExpiring sorts
// as +∞ so it never jumps ahead of a dated item.
// Tiers for "expiring first": a future/today deadline ranks by days-away (soonest first);
// no deadline sits in the middle; an already-expired, still-unattended item sinks into a
// tier of its own at the very bottom (most-recently-expired first) — see the "past"
// divider in ListView, which renders right where this tier begins. Attended items never
// carry expiry weight, since the deadline no longer matters once you've gone.
const NO_EXPIRY_RANK = 1e9
const PAST_RANK_BASE = 2e9
// "Going, then Planned" tiers: confirmed-Going entries (soonest first), then Planned-but-
// undecided entries (soonest first) — a fixed offset keeps every Going entry ahead of every
// undecided one regardless of how their dates compare, per the owner's ask to see Going
// events first and Planned ones after, not interleaved by date. A past Planned Date that's
// still unattended sinks into its own bottom tier, most-recently-passed first, mirroring
// expRank's past-due tier; no Planned Date (or an attended entry) sits in the plain middle.
const PLANNED_RANK_OFFSET = 1e6
const NO_PLANNED_RANK = 1e9
const PAST_PLANNED_RANK_BASE = 2e9
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
    if (n < 0) return PAST_PLANNED_RANK_BASE - n
    return e.going ? n : PLANNED_RANK_OFFSET + n
  }
  if (sort === 'az') {
    list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
  } else if (sort === 'added') {
    list.sort((a, b) => String(addedRank(b)).localeCompare(String(addedRank(a))))
  } else if (sort === 'planned') {
    list.sort((a, b) => {
      const ra = plannedRank(a), rb = plannedRank(b)
      if (ra !== rb) return ra - rb
      const added = String(addedRank(b)).localeCompare(String(addedRank(a)))
      return added !== 0 ? added : String(a?.name || '').localeCompare(String(b?.name || ''))
    })
  } else {
    list.sort((a, b) => {
      const ra = expRank(a), rb = expRank(b)
      if (ra !== rb) return ra - rb
      // tie-break: newer additions first, then name
      const added = String(addedRank(b)).localeCompare(String(addedRank(a)))
      return added !== 0 ? added : String(a?.name || '').localeCompare(String(b?.name || ''))
    })
  }
  return list
}

// The full pipeline used by the list: status → search → sort. Kept as one call so the
// view and the tests exercise the same order of operations.
export function triage(entries, { status = 'todo', query = '', scope = 'all', sort = 'expiring', today = todayKey() } = {}) {
  return sortEntries(filterBySearch(filterByStatus(entries, status), query, scope), sort, today)
}
