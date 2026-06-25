import { describe, it, expect } from 'vitest'
import {
  bestStreak,
  buildCheckinProperties,
  canSaveCheckin,
  checkinErrors,
  checkinName,
  currentStreak,
  cycleState,
  EMPTY_CHECKIN,
  forfeitDue,
  shouldWarnDontSkipTwice,
  weekIndexFromDay,
  type CheckinRecord,
  type CheckinDraft,
} from './checkins'

function rec(date: string, done: boolean): CheckinRecord {
  return { id: date, date, dayIndex: 0, done, oneLine: '', friction: '', sentToBuddy: false }
}

describe('checkinErrors / canSaveCheckin', () => {
  it('requires a non-empty one line to save (done or not)', () => {
    expect(canSaveCheckin(EMPTY_CHECKIN)).toBe(false)
    expect(checkinErrors(EMPTY_CHECKIN).oneLine).toBeTruthy()
    expect(canSaveCheckin({ ...EMPTY_CHECKIN, oneLine: 'walked to the corner' })).toBe(true)
    expect(canSaveCheckin({ ...EMPTY_CHECKIN, done: true, oneLine: '   ' })).toBe(false)
  })
})

describe('weekIndexFromDay', () => {
  it('maps day → week, clamped 1..6', () => {
    expect(weekIndexFromDay(1)).toBe(1)
    expect(weekIndexFromDay(7)).toBe(1)
    expect(weekIndexFromDay(8)).toBe(2)
    expect(weekIndexFromDay(42)).toBe(6)
    expect(weekIndexFromDay(43)).toBe(6)
    expect(weekIndexFromDay(0)).toBe(1)
  })
})

describe('checkinName', () => {
  it('zero-pads the day', () => {
    expect(checkinName(1, 7, '2026-07-12')).toBe('O1 · Day 07 · 2026-07-12')
  })
})

describe('cycleState', () => {
  const start = '2026-07-06'
  it('before the start', () => {
    expect(cycleState(start, new Date('2026-07-02T12:00:00'))).toMatchObject({ phase: 'before', daysUntilStart: 4 })
  })
  it('during the cycle', () => {
    expect(cycleState(start, new Date('2026-07-12T12:00:00'))).toMatchObject({ phase: 'active', dayIndex: 7 })
  })
  it('after day 42', () => {
    expect(cycleState(start, new Date('2026-08-20T12:00:00'))).toMatchObject({ phase: 'after' })
  })
})

describe('streaks', () => {
  it('currentStreak counts back from today (or yesterday if today is unmarked)', () => {
    const today = '2026-07-12'
    expect(currentStreak([rec('2026-07-10', true), rec('2026-07-11', true), rec('2026-07-12', true)], today)).toBe(3)
    // today not marked yet → still counts the run ending yesterday
    expect(currentStreak([rec('2026-07-10', true), rec('2026-07-11', true)], today)).toBe(2)
    // a gap breaks it
    expect(currentStreak([rec('2026-07-09', true), rec('2026-07-11', true)], today)).toBe(1)
  })

  it('bestStreak finds the longest run ever', () => {
    const records = [
      rec('2026-07-01', true),
      rec('2026-07-02', true),
      rec('2026-07-03', true),
      rec('2026-07-05', true),
      rec('2026-07-06', true),
    ]
    expect(bestStreak(records)).toBe(3)
    expect(bestStreak([])).toBe(0)
  })
})

describe('shouldWarnDontSkipTwice', () => {
  const today = '2026-07-12'
  it('warns on a single fresh gap (yesterday missed, day before done)', () => {
    expect(shouldWarnDontSkipTwice([rec('2026-07-10', true)], today)).toBe(true)
  })
  it('does not warn when there was no recent done day (already skipping)', () => {
    expect(shouldWarnDontSkipTwice([rec('2026-07-08', true)], today)).toBe(false)
  })
  it('does not warn when yesterday was done', () => {
    expect(shouldWarnDontSkipTwice([rec('2026-07-11', true)], today)).toBe(false)
  })
  it('does not warn once today is marked done', () => {
    expect(shouldWarnDontSkipTwice([rec('2026-07-10', true), rec('2026-07-12', true)], today)).toBe(false)
  })
})

describe('forfeitDue', () => {
  const today = '2026-07-12' // yesterday 07-11, day-before 07-10
  it('is due when the two prior days are both missed and the practice was under way', () => {
    expect(forfeitDue([rec('2026-07-08', true)], today)).toBe(true)
  })
  it('is not due before the practice was ever under way (no earlier done day)', () => {
    expect(forfeitDue([], today)).toBe(false)
    expect(forfeitDue([rec('2026-07-11', false)], today)).toBe(false)
  })
  it('is not due when only one of the two prior days was missed (single gap)', () => {
    expect(forfeitDue([rec('2026-07-08', true), rec('2026-07-10', true)], today)).toBe(false)
    expect(forfeitDue([rec('2026-07-08', true), rec('2026-07-11', true)], today)).toBe(false)
  })
})

describe('buildCheckinProperties', () => {
  const draft: CheckinDraft = { done: true, oneLine: 'walked', friction: '', sentToBuddy: true }
  it('maps to the right Notion property shapes', () => {
    const props = buildCheckinProperties('odyssey-1', draft, '2026-07-12', 7, 1) as Record<string, any>
    expect(props['Name'].title[0].text.content).toBe('O1 · Day 07 · 2026-07-12')
    expect(props['Odyssey'].relation).toEqual([{ id: 'odyssey-1' }])
    expect(props['Date'].date.start).toBe('2026-07-12')
    expect(props['Day Index'].number).toBe(7)
    expect(props['Week Index'].number).toBe(1)
    expect(props['Done'].checkbox).toBe(true)
    expect(props['One Line'].rich_text[0].text.content).toBe('walked')
    expect(props['Friction'].rich_text).toEqual([])
    expect(props['Sent To Buddy'].checkbox).toBe(true)
  })
})
