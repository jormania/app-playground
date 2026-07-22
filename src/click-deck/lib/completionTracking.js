// Shared "how recently was this completed" windowing, used by both the [S]
// COMPLETION_VELOCITY panel and the [A] COMPLETED: filter row — a single
// source of truth so the two surfaces can't disagree about which games fall
// inside a given window. Completed At is only ever stamped on an observed
// Backlog/Playing/Abandoned -> Completed transition (see App.jsx's
// handleUpdateStatus), never on a direct add or Editor save of an
// already-Completed game — mirrors Released At's "observed transition only"
// rule in releaseTracking.js.

export const COMPLETION_WINDOWS = { '1mo': 30, '3mo': 90, '6mo': 182, '12mo': 365 }

export function isCompletedWithinDays(game, days, now = Date.now()) {
  if (!game || game.status !== 'Completed' || !game.completedAt) return false
  const completedAtMs = new Date(game.completedAt).getTime()
  if (Number.isNaN(completedAtMs)) return false
  const age = now - completedAtMs
  // Guards against a corrupted/future-dated timestamp counting as "recent".
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000
}

// Completed games without a Completed At date (pre-R2 entries, per the
// design decision to leave them blank) still count in an all-time total but
// can never match a time window — callers surface that gap with an asterisk
// rather than silently under-counting.
export function countUndatedCompleted(games) {
  return games.filter(g => g.status === 'Completed' && !g.completedAt).length
}
