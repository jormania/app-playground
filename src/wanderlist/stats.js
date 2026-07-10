// Pure stats over the active backlog. Deliberately forward-looking: attended items carry
// no weight here at all — once you've gone, it drops out of the picture entirely, same as
// it does everywhere else in the app. Ordered by nature: backlog shape & near-term
// forecast first, then the motifs (Category / Tags / Place), each a frequency heatmap you
// can tap straight into a filtered search — same gesture as a chip on an entry itself.
import { daysUntil, todayKey, isPastExpired } from './dates.js'

// Every distinct value `getValues` pulls out of an entry, ranked by count (most-frequent
// first, ties alphabetical). Returns ALL of them — the Stats panel renders these as a
// frequency heatmap, so nothing is sliced off.
function rankCounts(entries, getValues) {
  const counts = new Map()
  for (const e of entries) {
    for (const name of getValues(e) || []) counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
}

const inNextDays = (dateKey, today, days) => {
  if (!dateKey) return false
  const n = daysUntil(dateKey, today)
  return n != null && n >= 0 && n <= days
}

export function computeStats(entries, today = todayKey()) {
  const active = (entries || []).filter(e => e && !e.attended)
  const total = active.length
  if (total === 0) {
    return {
      total: 0, expiringSoon: 0, needsAttention: 0, plannedSoon: 0, noDeadline: 0, withTickets: 0,
      nextUp: null, topCategories: [], topTags: [], topPlaces: [],
    }
  }

  const expiringSoon = active.filter(e => inNextDays(e.dateExpiring, today, 7)).length
  const needsAttention = active.filter(e => isPastExpired(e, today)).length
  const plannedSoon = active.filter(e => inNextDays(e.plannedDate, today, 7)).length
  const noDeadline = active.filter(e => !e.dateExpiring).length
  const withTickets = active.filter(e => e.tickets?.length > 0).length

  // The single soonest still-open deadline (today or later) — a concrete pointer at what
  // to act on next. Already-past deadlines surface via "needs attention" instead.
  const upcoming = active
    .filter(e => e.dateExpiring && daysUntil(e.dateExpiring, today) >= 0)
    .sort((a, b) => daysUntil(a.dateExpiring, today) - daysUntil(b.dateExpiring, today))
  const nextUp = upcoming[0]
    ? { name: upcoming[0].name || 'Untitled', days: daysUntil(upcoming[0].dateExpiring, today) }
    : null

  return {
    total,
    expiringSoon,
    needsAttention,
    plannedSoon,
    noDeadline,
    withTickets,
    nextUp,
    topCategories: rankCounts(active, e => (e.category ? [e.category] : [])),
    topTags: rankCounts(active, e => e.tags || []),
    topPlaces: rankCounts(active, e => (e.place ? [e.place] : [])),
  }
}
