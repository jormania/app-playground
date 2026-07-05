// Short, coarse relative-time labels for a "last opened" line — mirrors
// Cabinet's src/cabinet/lib/relativeTime.js (kept as a separate local copy,
// not shared, per the repo's per-app convention for small pure utils).
export function formatRelativeTime(timestamp, now = Date.now()) {
  const diff = now - timestamp
  if (diff < 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
