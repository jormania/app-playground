// The weekly loop: pure logic for the reflect-and-adjust pass. No React, no network — all
// unit-tested. The week is read honestly (count, don't judge), the behaviour is re-sized if
// needed (size is a dial, not a failure), and exactly one lever changes for next week.

import { CYCLE_DAYS } from './charter'
import { weekIndexFromDay, type CheckinRecord } from './checkins'

export const WEEKS = 6

export type Fit = 'Too big' | 'Too vague' | 'About right'
export const FIT_OPTIONS: Fit[] = ['Too big', 'Too vague', 'About right']

export interface ReflectionDraft {
  daysDone: number // 0..7
  breakPoints: string
  fit: Fit | ''
  oneAdjustment: string
  riskPlan: string
  temperature: number // 1..10 (0 = unset)
  buddyReflected: boolean
}

export interface ReflectionRecord extends ReflectionDraft {
  id: string
  weekIndex: number
  date: string
}

export const EMPTY_REFLECTION: ReflectionDraft = {
  daysDone: 0,
  breakPoints: '',
  fit: '',
  oneAdjustment: '',
  riskPlan: '',
  temperature: 0,
  buddyReflected: false,
}

/** Auto title, e.g. "O1 · Week 3". */
export function weeklyName(odysseyNumber: number, weekIndex: number): string {
  return `O${odysseyNumber} · Week ${weekIndex}`
}

/** Weeks whose final day has been reached — reflectable (completed weeks only). */
export function reflectableWeeks(dayIndex: number): number[] {
  const weeks: number[] = []
  for (let w = 1; w <= WEEKS; w++) {
    if (w * 7 <= Math.min(dayIndex, CYCLE_DAYS)) weeks.push(w)
  }
  return weeks
}

export type WeekStatus = 'locked' | 'due' | 'done'

export function weekStatus(week: number, dayIndex: number, hasRecord: boolean): WeekStatus {
  if (hasRecord) return 'done'
  return reflectableWeeks(dayIndex).includes(week) ? 'due' : 'locked'
}

/** Count of done check-ins falling in `weekIndex` — pre-fills "the data", editable by the user. */
export function daysDoneInWeek(checkins: CheckinRecord[], weekIndex: number): number {
  return checkins.filter((c) => c.done && weekIndexFromDay(c.dayIndex) === weekIndex).length
}

/** Whether Break Points must be filled this week. A perfect week (all 7 done) has nothing to
 *  diagnose, so it's optional; any miss makes naming the break point required — that's where the
 *  learning is. */
export function breakPointsRequired(draft: Pick<ReflectionDraft, 'daysDone'>): boolean {
  return draft.daysDone < 7
}

/** Validation: a reflection needs the data, the break points (when a day slipped), a chosen fit,
 *  the one adjustment, and a temperature reading. We don't let the week's row run empty. */
export function reflectionErrors(draft: ReflectionDraft): Partial<Record<keyof ReflectionDraft, string>> {
  const errors: Partial<Record<keyof ReflectionDraft, string>> = {}
  if (!Number.isFinite(draft.daysDone) || draft.daysDone < 0 || draft.daysDone > 7) {
    errors.daysDone = 'How many of the seven days? (0–7)'
  }
  if (breakPointsRequired(draft) && !draft.breakPoints.trim()) {
    errors.breakPoints = 'A day slipped — name where, and the real cue beneath it.'
  }
  if (!draft.fit) errors.fit = 'Was it too big, too vague, or about right?'
  if (!draft.oneAdjustment.trim()) {
    errors.oneAdjustment = 'Choose exactly one change for next week.'
  }
  if (!(draft.temperature >= 1 && draft.temperature <= 10)) {
    errors.temperature = 'How installed does it feel? (1–10)'
  }
  return errors
}

export function canSubmit(draft: ReflectionDraft): boolean {
  return Object.keys(reflectionErrors(draft)).length === 0
}

// ── Notion property mapping ─────────────────────────────────────────────────────────────────

function richText(value: string): { rich_text: { text: { content: string } }[] } {
  const v = value.trim()
  return { rich_text: v ? [{ text: { content: v } }] : [] }
}

export function buildReflectionProperties(
  odysseyId: string,
  draft: ReflectionDraft,
  weekIndex: number,
  dateISO: string,
  odysseyNumber: number,
): Record<string, unknown> {
  return {
    Name: { title: [{ text: { content: weeklyName(odysseyNumber, weekIndex) } }] },
    Odyssey: { relation: [{ id: odysseyId }] },
    'Week Index': { number: weekIndex },
    Date: { date: { start: dateISO } },
    'Days Done': { number: draft.daysDone },
    'Break Points': richText(draft.breakPoints),
    Fit: draft.fit ? { select: { name: draft.fit } } : { select: null },
    'One Adjustment': richText(draft.oneAdjustment),
    'Risk + Plan': richText(draft.riskPlan),
    Temperature: { number: draft.temperature || null },
    'Buddy Reflected': { checkbox: draft.buddyReflected },
  }
}
