import { describe, it, expect } from 'vitest'
import {
  breakPointsRequired,
  buildReflectionProperties,
  canSubmit,
  daysDoneInWeek,
  EMPTY_REFLECTION,
  reflectableWeeks,
  reflectionErrors,
  weeklyName,
  weekStatus,
  type ReflectionDraft,
} from './reflections'
import type { CheckinRecord } from './checkins'

function rec(dayIndex: number, done: boolean): CheckinRecord {
  return { id: `d${dayIndex}`, date: '', dayIndex, done, oneLine: '', friction: '', sentToBuddy: false }
}

function validDraft(over: Partial<ReflectionDraft> = {}): ReflectionDraft {
  return {
    ...EMPTY_REFLECTION,
    daysDone: 5,
    breakPoints: 'slipped on busy evenings',
    fit: 'About right',
    oneAdjustment: 'shrink the floor',
    temperature: 6,
    ...over,
  }
}

describe('weeklyName', () => {
  it('formats as "O1 · Week 3"', () => {
    expect(weeklyName(1, 3)).toBe('O1 · Week 3')
  })
})

describe('reflectableWeeks / weekStatus', () => {
  it('unlocks weeks only once their final day is reached', () => {
    expect(reflectableWeeks(0)).toEqual([]) // pre-start
    expect(reflectableWeeks(7)).toEqual([1])
    expect(reflectableWeeks(15)).toEqual([1, 2])
    expect(reflectableWeeks(42)).toEqual([1, 2, 3, 4, 5, 6])
    expect(reflectableWeeks(99)).toEqual([1, 2, 3, 4, 5, 6]) // capped
  })

  it('weekStatus reflects locked / due / done', () => {
    expect(weekStatus(1, 3, false)).toBe('locked') // day 3, week 1 not finished
    expect(weekStatus(1, 7, false)).toBe('due')
    expect(weekStatus(1, 7, true)).toBe('done')
  })
})

describe('daysDoneInWeek', () => {
  it('counts only done check-ins inside the week', () => {
    const checkins = [rec(1, true), rec(2, false), rec(3, true), rec(8, true)]
    expect(daysDoneInWeek(checkins, 1)).toBe(2) // days 1 & 3
    expect(daysDoneInWeek(checkins, 2)).toBe(1) // day 8
  })
})

describe('reflectionErrors / canSubmit', () => {
  it('requires days 0–7, a fit, the one adjustment, and a 1–10 temperature', () => {
    expect(canSubmit(validDraft())).toBe(true)
    expect(canSubmit(validDraft({ fit: '' }))).toBe(false)
    expect(canSubmit(validDraft({ oneAdjustment: '' }))).toBe(false)
    expect(canSubmit(validDraft({ temperature: 0 }))).toBe(false)
    expect(canSubmit(validDraft({ temperature: 11 }))).toBe(false)
    expect(canSubmit(validDraft({ daysDone: 9 }))).toBe(false)
    expect(reflectionErrors(validDraft({ fit: '' })).fit).toBeTruthy()
    expect(reflectionErrors(validDraft({ oneAdjustment: '' })).oneAdjustment).toBeTruthy()
  })

  it('makes break points required only when a day was missed', () => {
    expect(breakPointsRequired({ daysDone: 6 })).toBe(true)
    expect(breakPointsRequired({ daysDone: 7 })).toBe(false)
    // a perfect week with no break points is fine
    expect(canSubmit(validDraft({ daysDone: 7, breakPoints: '' }))).toBe(true)
    // a week with a miss and no break points is blocked
    expect(canSubmit(validDraft({ daysDone: 5, breakPoints: '' }))).toBe(false)
    expect(reflectionErrors(validDraft({ daysDone: 5, breakPoints: '' })).breakPoints).toBeTruthy()
  })
})

describe('buildReflectionProperties', () => {
  it('maps to the right Notion property shapes', () => {
    const props = buildReflectionProperties(
      'odyssey-1',
      validDraft({ breakPoints: 'evenings', oneAdjustment: 'smaller', buddyReflected: true }),
      3,
      '2026-07-27',
      1,
    ) as Record<string, any>
    expect(props['Name'].title[0].text.content).toBe('O1 · Week 3')
    expect(props['Odyssey'].relation).toEqual([{ id: 'odyssey-1' }])
    expect(props['Week Index'].number).toBe(3)
    expect(props['Days Done'].number).toBe(5)
    expect(props['Fit'].select.name).toBe('About right')
    expect(props['Temperature'].number).toBe(6)
    expect(props['Break Points'].rich_text[0].text.content).toBe('evenings')
    expect(props['Buddy Reflected'].checkbox).toBe(true)
  })

  it('writes a null select when no fit is chosen', () => {
    const props = buildReflectionProperties('o', { ...EMPTY_REFLECTION }, 1, '2026-07-13', 1) as Record<string, any>
    expect(props['Fit'].select).toBeNull()
    expect(props['Temperature'].number).toBeNull()
  })
})
