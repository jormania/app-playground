import type { ISODate, WeekKey } from './types'
import { weekFromKey, weekOfDate, weeksBetween } from './week'

/**
 * Seasons: twelve listening weeks each, counted from the listener's first
 * week. Every twelve weeks the curator writes the season in review; before a
 * season ends, a provisional "so far" can be read.
 */
export const SEASON_WEEKS = 12

export interface Season {
  number: number
  weekKeys: WeekKey[]
  startsOn: ISODate
  endsOn: ISODate
  /** "5 October – 27 December 2026" */
  label: string
  /** Every one of its weeks is over. */
  complete: boolean
  /** Weeks of it so far, up to and including this one. */
  weeksSoFar: number
}

/** The week `n` weeks after `key` (n may be negative). */
export function addWeeks(key: WeekKey, n: number): WeekKey {
  const [y, m, d] = weekFromKey(key).startsOn.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + n * 7 * 86_400_000)
  return weekOfDate({ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }).key
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayMonth = (iso: ISODate) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}` }

/** Season `n` of a journey that began in `firstWeek`, as it stands in week `now`. */
export function season(firstWeek: WeekKey, n: number, now: WeekKey): Season {
  const first = addWeeks(firstWeek, (n - 1) * SEASON_WEEKS)
  const weekKeys = Array.from({ length: SEASON_WEEKS }, (_, i) => addWeeks(first, i))
  const startsOn = weekFromKey(weekKeys[0]).startsOn
  const endsOn = weekFromKey(weekKeys[SEASON_WEEKS - 1]).endsOn
  const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4)
  return {
    number: n,
    weekKeys,
    startsOn,
    endsOn,
    label: `${dayMonth(startsOn)}${sameYear ? '' : ` ${startsOn.slice(0, 4)}`} – ${dayMonth(endsOn)} ${endsOn.slice(0, 4)}`,
    complete: weeksBetween(weekKeys[SEASON_WEEKS - 1], now) > 0,
    weeksSoFar: Math.max(0, Math.min(SEASON_WEEKS, weeksBetween(weekKeys[0], now) + 1)),
  }
}

/** The number of the season that week `now` falls in. */
export function seasonNumberAt(firstWeek: WeekKey, now: WeekKey): number {
  return Math.floor(Math.max(0, weeksBetween(firstWeek, now)) / SEASON_WEEKS) + 1
}

const NAMES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
/** "Season one" */
export const seasonName = (n: number) => `Season ${NAMES[n - 1] ?? n}`
