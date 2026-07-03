// The two generic "should this notification fire now?" shapes every app's reminders
// converge on. Pure and side-effect-free so they're trivially unit-testable and safely
// shared between a page-context ES module and a hand-ported service-worker copy.
import { dayKey, minutesOfDay, weekKey } from './dayKey'

/** Once-per-calendar-day, gated on a local time-of-day and an optional "already done"
 *  suppression (e.g. don't nag once today's entry/check-in already exists). */
export function shouldFireOncePerDay(opts: {
  enabled: boolean
  now: Date
  targetMinutes: number | null
  lastSentDayKey: string
  doneDayKey?: string
}): boolean {
  const { enabled, now, targetMinutes, lastSentDayKey, doneDayKey = '' } = opts
  if (!enabled || targetMinutes == null) return false
  const today = dayKey(now)
  if (doneDayKey === today) return false
  if (lastSentDayKey === today) return false
  return minutesOfDay(now) >= targetMinutes
}

/** Once-per-calendar-week, gated on the right weekday + local time-of-day. */
export function shouldFireOncePerWeek(opts: {
  enabled: boolean
  now: Date
  dow: number
  targetMinutes: number
  lastSentWeekKey: string
}): boolean {
  const { enabled, now, dow, targetMinutes, lastSentWeekKey } = opts
  if (!enabled) return false
  if (now.getDay() !== dow) return false
  if (lastSentWeekKey === weekKey(now)) return false
  return minutesOfDay(now) >= targetMinutes
}

/** Once per stable id — an event-based nudge (no time-of-day gate), fired once for a given
 *  id (a draft id, an odyssey id, …) and never again for that same id. */
export function shouldFireOncePerId(opts: {
  enabled: boolean
  ready: boolean
  id: string
  lastSentId: string
}): boolean {
  const { enabled, ready, id, lastSentId } = opts
  if (!enabled || !ready || !id) return false
  return lastSentId !== id
}
