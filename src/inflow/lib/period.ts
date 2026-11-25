/**
 * The selected period, the previous equivalent one, and how a period is cut
 * into chart buckets. One module so the dashboard, the reports and the list's
 * drill-down never disagree about what "this month" means.
 */
import {
  addDays, addMonths, daysBetween, endOfMonth, monthShort, parseDate, startOfMonth,
  startOfWeek, toDateString, weekdayShort,
} from './dates'

export type PeriodPreset = 'week' | 'month' | 'last_month' | 'year' | 'custom'

export interface PeriodChoice {
  preset: PeriodPreset
  /** Only for `custom`. */
  from?: string
  to?: string
}

export interface Range {
  from: string
  to: string
  label: string
}

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  week: 'This week',
  month: 'This month',
  last_month: 'Last month',
  year: 'This year',
  custom: 'Custom',
}

export function resolvePeriod(choice: PeriodChoice, today: string): Range {
  switch (choice.preset) {
    case 'week': {
      const from = startOfWeek(today)
      return { from, to: addDays(from, 6), label: 'This week' }
    }
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today), label: 'This month' }
    case 'last_month': {
      const from = startOfMonth(addMonths(startOfMonth(today), -1))
      return { from, to: endOfMonth(from), label: 'Last month' }
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31`, label: 'This year' }
    case 'custom': {
      let from = choice.from || startOfMonth(today)
      let to = choice.to || today
      if (from > to) [from, to] = [to, from]
      return { from, to, label: `${from} – ${to}` }
    }
  }
}

/**
 * The previous equivalent period: last week, last month (whole), last year, or
 * for a custom range the same number of days immediately before it.
 */
export function previousRange(choice: PeriodChoice, today: string): Range {
  const cur = resolvePeriod(choice, today)
  switch (choice.preset) {
    case 'week':
      return { from: addDays(cur.from, -7), to: addDays(cur.to, -7), label: 'last week' }
    case 'month':
    case 'last_month': {
      const from = startOfMonth(addMonths(cur.from, -1))
      return { from, to: endOfMonth(from), label: 'the month before' }
    }
    case 'year': {
      const y = Number(cur.from.slice(0, 4)) - 1
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'last year' }
    }
    case 'custom': {
      const len = daysBetween(cur.from, cur.to) + 1
      return { from: addDays(cur.from, -len), to: addDays(cur.from, -1), label: 'the period before' }
    }
  }
}

/**
 * For a period still under way, the slice of the previous one that is
 * comparable so far: this month to the 24th against last month to the 24th.
 * Comparing a half-finished month against a whole one reads as a collapse.
 */
export function comparableSoFar(cur: Range, prev: Range, today: string): Range {
  if (today < cur.from || today > cur.to) return prev
  const elapsed = daysBetween(cur.from, today)
  const to = addDays(prev.from, elapsed)
  return { ...prev, to: to > prev.to ? prev.to : to }
}

export function inRange(date: string, r: { from: string; to: string }): boolean {
  return date >= r.from && date <= r.to
}

export interface Bucket {
  from: string
  to: string
  label: string
}

/**
 * Cut a range into chart buckets: days for up to two weeks, weeks (Monday-
 * based, clipped to the range) up to about three months, months beyond.
 */
export function buckets(r: { from: string; to: string }): Bucket[] {
  const days = daysBetween(r.from, r.to) + 1
  const out: Bucket[] = []
  if (days <= 14) {
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
      out.push({ from: d, to: d, label: days <= 7 ? weekdayShort(d) : String(Number(d.slice(8))) })
    }
    return out
  }
  if (days <= 93) {
    let start = r.from
    while (start <= r.to) {
      const weekEnd = addDays(startOfWeek(start), 6)
      const end = weekEnd > r.to ? r.to : weekEnd
      out.push({ from: start, to: end, label: `${Number(start.slice(8))} ${monthShort(start)}` })
      start = addDays(end, 1)
    }
    return out
  }
  let start = r.from
  while (start <= r.to) {
    const mEnd = endOfMonth(start)
    const end = mEnd > r.to ? r.to : mEnd
    out.push({ from: start, to: end, label: monthShort(start) })
    start = addDays(end, 1)
  }
  return out
}

/** Map each current bucket to the same-position bucket in the previous range, for ghost bars. */
export function alignedPrevious(cur: Bucket[], prev: { from: string; to: string }): Bucket[] {
  const prevBuckets = buckets(prev)
  return cur.map((_, i) => prevBuckets[i] ?? { from: '9999-12-31', to: '9999-12-31', label: '' })
}

export function todayString(now = new Date()): string {
  return toDateString(now)
}

export { parseDate }
