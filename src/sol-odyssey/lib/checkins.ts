// The daily loop: pure logic for one calendar day's check-in, the cycle phase, and the flexible
// streak. No React, no network — all unit-tested. The metric that matters is NOT "never miss"
// but "never skip two days running" (spec): a lapse is data, handled warmly.

import { CYCLE_DAYS, computeDayIndex, isoAddDays } from './charter'

export interface CheckinDraft {
  done: boolean
  oneLine: string
  friction: string
  sentToBuddy: boolean
}

export interface CheckinRecord extends CheckinDraft {
  id: string
  date: string // yyyy-mm-dd
  dayIndex: number
}

export const EMPTY_CHECKIN: CheckinDraft = {
  done: false,
  oneLine: '',
  friction: '',
  sentToBuddy: false,
}

/** Validation: one line a day is the point — the highest-yield habit lever — so it's required to
 *  save a check-in (done or not). A behaviour you don't notice in writing doesn't compound. */
export function checkinErrors(draft: CheckinDraft): Partial<Record<keyof CheckinDraft, string>> {
  const errors: Partial<Record<keyof CheckinDraft, string>> = {}
  if (!draft.oneLine.trim()) errors.oneLine = 'One line keeps the day — what happened, or what you noticed.'
  return errors
}

export function canSaveCheckin(draft: CheckinDraft): boolean {
  return Object.keys(checkinErrors(draft)).length === 0
}

/** 1..6 week the day falls in. */
export function weekIndexFromDay(dayIndex: number): number {
  return Math.min(6, Math.max(1, Math.ceil(dayIndex / 7)))
}

/** Auto title, e.g. "O1 · Day 07 · 2026-07-12". */
export function checkinName(odysseyNumber: number, dayIndex: number, dateISO: string): string {
  return `O${odysseyNumber} · Day ${String(dayIndex).padStart(2, '0')} · ${dateISO}`
}

export type CyclePhase = 'before' | 'active' | 'after'

export interface CycleState {
  phase: CyclePhase
  dayIndex: number
  daysUntilStart: number
}

/** Where `today` sits relative to the 42-day cycle. */
export function cycleState(startISO: string, today = new Date()): CycleState {
  const dayIndex = computeDayIndex(startISO, today)
  if (dayIndex < 1) return { phase: 'before', dayIndex, daysUntilStart: 1 - dayIndex }
  if (dayIndex > CYCLE_DAYS) return { phase: 'after', dayIndex, daysUntilStart: 0 }
  return { phase: 'active', dayIndex, daysUntilStart: 0 }
}

// ── Flexible streak (operates on the set of DONE dates) ─────────────────────────────────────

function doneSet(records: CheckinRecord[]): Set<string> {
  return new Set(records.filter((r) => r.done).map((r) => r.date))
}

/** Consecutive done days ending at today (or, if today isn't marked yet, ending at yesterday —
 *  so an un-checked today never reads as a broken streak). */
export function currentStreak(records: CheckinRecord[], todayISO: string): number {
  const done = doneSet(records)
  let cursor = done.has(todayISO) ? todayISO : isoAddDays(todayISO, -1)
  let streak = 0
  while (done.has(cursor)) {
    streak += 1
    cursor = isoAddDays(cursor, -1)
  }
  return streak
}

/** Longest run of consecutive done days, ever. */
export function bestStreak(records: CheckinRecord[]): number {
  const dates = [...doneSet(records)].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of dates) {
    run = prev && isoAddDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** The warm "never skip two days running" nudge: yesterday was a miss, the day before was done,
 *  and today isn't marked yet — one gap has opened, so close it before a second forms. */
export function shouldWarnDontSkipTwice(records: CheckinRecord[], todayISO: string): boolean {
  const done = doneSet(records)
  if (done.has(todayISO)) return false
  return !done.has(isoAddDays(todayISO, -1)) && done.has(isoAddDays(todayISO, -2))
}

/** The forfeit-on-lapse condition: the two days before today are BOTH missed, and the practice was
 *  genuinely under way (at least one done day earlier than that). Distinguishes a real two-day break
 *  from the empty days at the very start of a cycle. */
export function forfeitDue(records: CheckinRecord[], todayISO: string): boolean {
  const done = doneSet(records)
  const d1 = isoAddDays(todayISO, -1)
  const d2 = isoAddDays(todayISO, -2)
  if (done.has(d1) || done.has(d2)) return false
  // Was the practice ever under way before the break? (a done day strictly before d2)
  return [...done].some((d) => d < d2)
}

// ── Notion property mapping ─────────────────────────────────────────────────────────────────

function richText(value: string): { rich_text: { text: { content: string } }[] } {
  const v = value.trim()
  return { rich_text: v ? [{ text: { content: v } }] : [] }
}

export function buildCheckinProperties(
  odysseyId: string,
  draft: CheckinDraft,
  dateISO: string,
  dayIndex: number,
  odysseyNumber: number,
): Record<string, unknown> {
  return {
    Name: { title: [{ text: { content: checkinName(odysseyNumber, dayIndex, dateISO) } }] },
    Odyssey: { relation: [{ id: odysseyId }] },
    Date: { date: { start: dateISO } },
    'Day Index': { number: dayIndex },
    'Week Index': { number: weekIndexFromDay(dayIndex) },
    Done: { checkbox: draft.done },
    'One Line': richText(draft.oneLine),
    Friction: richText(draft.friction),
    'Sent To Buddy': { checkbox: draft.sentToBuddy },
  }
}
