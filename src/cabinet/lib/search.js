// Name and tags only — deliberately not description/"More" text, which would
// surface unrelated apps on incidental word matches instead of a deliberate
// name or tag.
export function matchesSearch(app, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (app.title.toLowerCase().includes(q)) return true
  return (app.tags || []).some((tag) => tag.toLowerCase().includes(q))
}
