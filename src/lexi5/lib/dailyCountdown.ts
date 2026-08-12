/**
 * Time until the next daily word.
 *
 * The word rolls over at *local* midnight — `getWord` keys off `new Date().toDateString()`,
 * so the boundary is the device's own calendar day, not UTC. Anything that tells the player
 * when the next word arrives has to use the same boundary or it will be wrong for most of
 * the world.
 */

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextWord(now: Date = new Date()): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

/**
 * Formats a duration as a coarse countdown — "5h 12m", "12m", "under a minute".
 *
 * Deliberately not second-by-second: a ticking seconds display invites watching the clock,
 * and re-rendering every second for a line of ambient text is a poor trade.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 1) return 'under a minute'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
