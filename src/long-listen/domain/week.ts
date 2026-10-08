import type { ISODate, WeekKey } from './types'

/**
 * The listening week: Monday to Sunday, ISO-numbered, in the listener's own
 * time zone. Never the device's or the server's — the curator runs on Vercel in
 * UTC and the phone may be abroad; a Sunday-night listen in Bucharest belongs to
 * the Bucharest week either way. The zone is a setting, defaulting to Bucharest.
 *
 * Everything here works on a civil date (year, month, day) taken out of an
 * instant with Intl, then does plain calendar arithmetic in UTC, where there
 * are no daylight-saving gaps to trip over.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Bucharest'

export interface CivilDate {
  year: number
  month: number // 1-12
  day: number
}

/** The calendar date `instant` falls on in `timeZone`. */
export function civilDateIn(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function toUtc({ year, month, day }: CivilDate): number {
  return Date.UTC(year, month - 1, day)
}

function fromUtc(ms: number): CivilDate {
  const d = new Date(ms)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export function isoDate(c: CivilDate): ISODate {
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
}

const DAY = 86_400_000

/** ISO weekday, Monday = 1 … Sunday = 7. */
function isoWeekday(c: CivilDate): number {
  const dow = new Date(toUtc(c)).getUTCDay()
  return dow === 0 ? 7 : dow
}

export interface ListeningWeek {
  key: WeekKey
  startsOn: ISODate
  endsOn: ISODate
  /** "5–11 October 2026" */
  label: string
  number: number
  isoYear: number
}

/** The ISO week a civil date belongs to. */
export function weekOfDate(c: CivilDate): ListeningWeek {
  const monday = toUtc(c) - (isoWeekday(c) - 1) * DAY
  const thursday = monday + 3 * DAY
  const isoYear = new Date(thursday).getUTCFullYear()
  const jan4 = Date.UTC(isoYear, 0, 4)
  const jan4Monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY
  const number = Math.round((monday - jan4Monday) / (7 * DAY)) + 1
  const start = fromUtc(monday)
  const end = fromUtc(monday + 6 * DAY)
  return {
    key: `${isoYear}-W${String(number).padStart(2, '0')}`,
    startsOn: isoDate(start),
    endsOn: isoDate(end),
    label: weekLabel(start, end),
    number,
    isoYear,
  }
}

/** The listening week `instant` falls in, in `timeZone`. */
export function weekOf(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): ListeningWeek {
  return weekOfDate(civilDateIn(instant, timeZone))
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function weekLabel(start: CivilDate, end: CivilDate): string {
  if (start.year !== end.year) {
    return `${start.day} ${MONTHS[start.month - 1]} ${start.year} – ${end.day} ${MONTHS[end.month - 1]} ${end.year}`
  }
  if (start.month !== end.month) {
    return `${start.day} ${MONTHS[start.month - 1]} – ${end.day} ${MONTHS[end.month - 1]} ${end.year}`
  }
  return `${start.day}–${end.day} ${MONTHS[start.month - 1]} ${end.year}`
}

/** Parse `2026-W41` back into its week. */
export function weekFromKey(key: WeekKey): ListeningWeek {
  const m = /^(\d{4})-W(\d{2})$/.exec(key)
  if (!m) throw new Error(`Not a week key: ${key}`)
  const isoYear = Number(m[1])
  const n = Number(m[2])
  const jan4 = Date.UTC(isoYear, 0, 4)
  const jan4Monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY
  return weekOfDate(fromUtc(jan4Monday + (n - 1) * 7 * DAY))
}

/** Whole weeks from `a` to `b` (positive when b is later). */
export function weeksBetween(a: WeekKey, b: WeekKey): number {
  const sa = Date.parse(`${weekFromKey(a).startsOn}T00:00:00Z`)
  const sb = Date.parse(`${weekFromKey(b).startsOn}T00:00:00Z`)
  return Math.round((sb - sa) / (7 * DAY))
}

/** "six weeks ago", "last week", "in March" — how the curator speaks about time. */
export function sinceWords(then: WeekKey, now: WeekKey): string {
  const n = weeksBetween(then, now)
  if (n <= 0) return 'this week'
  if (n === 1) return 'last week'
  if (n < 9) return `${['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][n]} weeks ago`
  const start = weekFromKey(then).startsOn
  const [y, mo] = start.split('-').map(Number)
  const nowYear = Number(weekFromKey(now).startsOn.slice(0, 4))
  return y === nowYear ? `in ${MONTHS[mo - 1]}` : `in ${MONTHS[mo - 1]} ${y}`
}

/** Is `zone` an IANA zone this runtime understands? */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
