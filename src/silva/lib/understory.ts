/**
 * Pure date logic for the understory's season expiry — no I/O, so every
 * branch is directly testable. See SILVA.md "The understory": unkept things
 * fade after a configurable season (default 90 days) and are quietly
 * dropped. "Dropped" is a state transition to `Released`, not a Notion row
 * deletion — consistent with "compost, not debt."
 */

import type { Thing } from './notion'

export const DEFAULT_SEASON_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** A DST-proof calendar-day number: reads the date's local Y/M/D (so "today"
 *  still means the user's own calendar day), then anchors it to UTC noon —
 *  never midnight, so subtracting two of these can't land within the ±1h
 *  window a spring-forward/fall-back transition shifts local midnight by. A
 *  naive `localMidnightMs / DAY_MS` loses a day whenever the two dates
 *  straddle a DST change (caught by the season-boundary test below). */
function calendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / DAY_MS)
}

/**
 * Today as a plain ISO date (YYYY-MM-DD), in the reader's OWN calendar.
 *
 * `new Date().toISOString().slice(0, 10)` — which every date-stamping call
 * site in this app used, from `kept`/`coined`/`made` in store.ts through
 * the walk's daily seed (walk.ts), the reading-history bucket (seen.ts) and
 * the provocation gate's "quiet week" clock (provocationThreshold.ts) — is
 * the *UTC* date. East of UTC that reads as yesterday until the offset has
 * passed (00:30 in Bucharest stamps the day before); west of UTC it reads
 * as tomorrow from the evening on. Every one of those call sites otherwise
 * reasons in the reader's local calendar day (see `calendarDayNumber`
 * above), so the write and the read were quietly a day apart depending on
 * timezone and hour — including `walk.ts`'s own guarantee that the walk
 * "refreshes on the calendar, not on your attention": the calendar it
 * meant was the wrong one.
 */
export function todayIso(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Whole calendar days elapsed since an ISO (YYYY-MM-DD) date — DST-safe (see
 *  `calendarDayNumber`), so a season crossing a clock change never miscounts. */
export function daysSince(isoDate: string, today: Date = new Date()): number {
  const then = calendarDayNumber(new Date(`${isoDate}T00:00:00`))
  const now = calendarDayNumber(today)
  return now - then
}

/** Days left in the season before an understory thing expires. Can go
 *  negative once past the season — callers should clamp for display. */
export function daysRemaining(
  thing: Pick<Thing, 'encountered'>,
  seasonDays: number = DEFAULT_SEASON_DAYS,
  today: Date = new Date(),
): number {
  return seasonDays - daysSince(thing.encountered, today)
}

/** A thing is expired once its season has fully elapsed AND it's still
 *  sitting in the understory — a thing already Kept or Released is never
 *  "expired", the field is meaningless once it's left the understory. */
export function isExpired(
  thing: Pick<Thing, 'encountered' | 'state'>,
  seasonDays: number = DEFAULT_SEASON_DAYS,
  today: Date = new Date(),
): boolean {
  return thing.state === 'Understory' && daysRemaining(thing, seasonDays, today) <= 0
}

/** 1 = just encountered, 0 = at the edge of expiry (or past it) — the
 *  understory view uses this to fade a row rather than show a countdown
 *  number, per SILVA.md's "shown as a fade rather than a number." */
export function fadeRatio(
  thing: Pick<Thing, 'encountered'>,
  seasonDays: number = DEFAULT_SEASON_DAYS,
  today: Date = new Date(),
): number {
  const remaining = daysRemaining(thing, seasonDays, today)
  return Math.max(0, Math.min(1, remaining / seasonDays))
}
