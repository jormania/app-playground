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

// Status segment for the backlog: things still to do, things already attended, or all.
export const STATUSES = [
  { value: 'todo', label: 'To-do' },
  { value: 'attended', label: 'Attended' },
  { value: 'all', label: 'All' },
]

export const SORTS = [
  { value: 'expiring', label: 'Expiring first' },
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
  const attended = status === 'attended'
  return (entries || []).filter(e => Boolean(e?.attended) === attended)
}

// Sort a copy of the list. "Expiring first" is the default: soonest real deadline at
// the top, items with no deadline after them (by recency), and — within either group —
// unattended before attended so checked-off things sink. A missing dateExpiring sorts
// as +∞ so it never jumps ahead of a dated item.
export function sortEntries(entries, sort = 'expiring', today = todayKey()) {
  const list = [...(entries || [])]
  const addedRank = (e) => e?.dateAdded || ''
  const expRank = (e) => {
    if (!e?.dateExpiring) return Infinity
    const n = daysUntil(e.dateExpiring, today)
    return n == null ? Infinity : n
  }
  if (sort === 'az') {
    list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
  } else if (sort === 'added') {
    list.sort((a, b) => String(addedRank(b)).localeCompare(String(addedRank(a))))
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
