import { describe, it, expect } from 'vitest'
import {
  parseDailyTime,
  parseWeeklySlot,
  shouldFireDaily,
  shouldFireWeekly,
  shouldFireStart,
  shouldFireHarvest,
  dateKey,
  weekKey,
  type ReminderState,
} from './reminders'

function state(over: Partial<ReminderState> = {}): ReminderState {
  return {
    enabled: true,
    dailyMinutes: 600, // 10:00
    weekly: null,
    cycleActive: true,
    todayLogged: '',
    weeklyDue: false,
    startReady: false,
    startId: '',
    harvestReady: false,
    harvestId: '',
    ...over,
  }
}

// A Sunday, 10:30 local.
const sun1030 = new Date(2026, 6, 12, 10, 30) // 2026-07-12 is a Sunday
const sun0900 = new Date(2026, 6, 12, 9, 0)

describe('parseDailyTime', () => {
  it('parses HH:MM to minutes', () => {
    expect(parseDailyTime('10:30')).toBe(630)
    expect(parseDailyTime('07:05')).toBe(425)
    expect(parseDailyTime('00:00')).toBe(0)
  })
  it('rejects out-of-range or junk', () => {
    expect(parseDailyTime('24:00')).toBeNull()
    expect(parseDailyTime('10:75')).toBeNull()
    expect(parseDailyTime('nope')).toBeNull()
    expect(parseDailyTime('')).toBeNull()
  })
})

describe('parseWeeklySlot', () => {
  it('parses a lenient "Day HH:MM"', () => {
    expect(parseWeeklySlot('Sun 18:00')).toEqual({ dow: 0, minutes: 1080 })
    expect(parseWeeklySlot('monday 9:00')).toEqual({ dow: 1, minutes: 540 })
    expect(parseWeeklySlot('Wed 07:30')).toEqual({ dow: 3, minutes: 450 })
  })
  it('is null without a recognisable day or time', () => {
    expect(parseWeeklySlot('18:00')).toBeNull() // no day
    expect(parseWeeklySlot('Sunday')).toBeNull() // no time
    expect(parseWeeklySlot('Funday 10:00')).toBeNull() // not a day
  })
})

describe('shouldFireDaily', () => {
  it('fires when enabled, active, past the time, not logged, not yet sent', () => {
    expect(shouldFireDaily(state(), '', sun1030)).toBe(true)
  })
  it('is suppressed once today is logged or already sent', () => {
    expect(shouldFireDaily(state({ todayLogged: dateKey(sun1030) }), '', sun1030)).toBe(false)
    expect(shouldFireDaily(state(), dateKey(sun1030), sun1030)).toBe(false)
  })
  it('does not fire before the time, when inactive, or disabled', () => {
    expect(shouldFireDaily(state(), '', sun0900)).toBe(false) // 09:00 < 10:00
    expect(shouldFireDaily(state({ cycleActive: false }), '', sun1030)).toBe(false)
    expect(shouldFireDaily(state({ enabled: false }), '', sun1030)).toBe(false)
    expect(shouldFireDaily(state({ dailyMinutes: null }), '', sun1030)).toBe(false)
  })
})

describe('shouldFireWeekly', () => {
  const weekly = { dow: 0, minutes: 600 } // Sunday 10:00
  it('fires on the right day, past the slot, when due and not sent this week', () => {
    expect(shouldFireWeekly(state({ weekly, weeklyDue: true }), '', sun1030)).toBe(true)
  })
  it('is suppressed when not due, wrong day, before time, or already sent this week', () => {
    expect(shouldFireWeekly(state({ weekly, weeklyDue: false }), '', sun1030)).toBe(false)
    expect(shouldFireWeekly(state({ weekly: { dow: 1, minutes: 600 }, weeklyDue: true }), '', sun1030)).toBe(false)
    expect(shouldFireWeekly(state({ weekly, weeklyDue: true }), '', sun0900)).toBe(false)
    expect(shouldFireWeekly(state({ weekly, weeklyDue: true }), weekKey(sun1030), sun1030)).toBe(false)
  })
})

describe('shouldFireStart / shouldFireHarvest (event-based, once per id)', () => {
  it('start fires when ready and not yet sent for that draft', () => {
    expect(shouldFireStart(state({ startReady: true, startId: 'd1' }), '')).toBe(true)
    expect(shouldFireStart(state({ startReady: true, startId: 'd1' }), 'd1')).toBe(false)
    expect(shouldFireStart(state({ startReady: false, startId: 'd1' }), '')).toBe(false)
  })
  it('harvest fires when ready and not yet sent for that Odyssey', () => {
    expect(shouldFireHarvest(state({ harvestReady: true, harvestId: 'o1' }), '')).toBe(true)
    expect(shouldFireHarvest(state({ harvestReady: true, harvestId: 'o1' }), 'o1')).toBe(false)
    expect(shouldFireHarvest(state({ harvestReady: false, harvestId: 'o1' }), '')).toBe(false)
  })
})
