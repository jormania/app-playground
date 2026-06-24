// Pure search over entries. Scope chooses which fields to look in; the query is
// tokenised on whitespace and every token must match somewhere in scope (AND),
// case-insensitively. Empty query returns everything.
export const SCOPES = [
  { value: 'all', label: 'all' },
  { value: 'text', label: 'text' },
  { value: 'tags', label: 'tags' },
  { value: 'people', label: 'people' },
]

function haystack(entry, scope) {
  const parts = []
  if (scope === 'all' || scope === 'text') parts.push(entry.title || '', entry.entry || '')
  if (scope === 'all' || scope === 'tags') parts.push((entry.tags || []).join(' '))
  if (scope === 'all' || scope === 'people') parts.push((entry.people || []).join(' '))
  return parts.join('  ').toLowerCase() //  keeps tokens from spanning fields
}

export function filterEntries(entries, query, scope = 'all') {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return entries || []
  return (entries || []).filter(e => {
    const hay = haystack(e, scope)
    return tokens.every(t => hay.includes(t))
  })
}
