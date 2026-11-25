/**
 * Dates as local `YYYY-MM-DD` strings throughout. `new Date('2026-07-01')` is
 * parsed as UTC and lands on the previous day west of Greenwich; building from
 * parts keeps every comparison local.
 */

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

export function addMonths(s: string, n: number): string {
  const d = parseDate(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toDateString(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

/** Monday of the week containing `s` (weeks start on Monday in Romania). */
export function startOfWeek(s: string): string {
  const d = parseDate(s)
  const offset = (d.getDay() + 6) % 7
  return addDays(s, -offset)
}

export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`
}

export function endOfMonth(s: string): string {
  const d = parseDate(startOfMonth(s))
  return toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function yearOf(s: string): number {
  return Number(s.slice(0, 4))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function monthShort(s: string): string {
  return MONTHS[Number(s.slice(5, 7)) - 1]
}

export function weekdayShort(s: string): string {
  return DAYS[(parseDate(s).getDay() + 6) % 7]
}

/** "24 Nov", or "24 Nov 2025" outside `thisYear`. */
export function shortDate(s: string, thisYear?: number): string {
  const base = `${Number(s.slice(8, 10))} ${monthShort(s)}`
  return thisYear !== undefined && yearOf(s) !== thisYear ? `${base} ${s.slice(0, 4)}` : base
}

export function monthLabel(s: string): string {
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${full[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`
}
