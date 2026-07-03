// Local-time date math shared by every app's notification scheduler. Always local, never
// `toISOString()` (UTC, which shifts the calendar day for anyone west of Greenwich).

/** Local 'YYYY-MM-DD' for a Date — the spine of every "once per day" guard. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Minutes since local midnight — for comparing against a "fire after HH:MM" time. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** A stable per-ISO-week key (year + week number), for once-a-week suppression. */
export function weekKey(date: Date): string {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Local midnight (start of the next day) in ms — the usual upper bound of an evening window. */
export function nextMidnight(date: Date): number {
  const m = new Date(date)
  m.setHours(24, 0, 0, 0)
  return m.getTime()
}
