import { describe, it, expect } from 'vitest'
import { shouldFireOncePerDay, shouldFireOncePerWeek, shouldFireOncePerId } from './schedule'

const sun1030 = new Date(2026, 6, 12, 10, 30) // Sunday, 2026-07-12
const sun0900 = new Date(2026, 6, 12, 9, 0)

describe('shouldFireOncePerDay', () => {
  it('fires when enabled, past the target time, not done, not yet sent', () => {
    expect(
      shouldFireOncePerDay({ enabled: true, now: sun1030, targetMinutes: 600, lastSentDayKey: '' }),
    ).toBe(true)
  })
  it('is suppressed once done today or already sent today', () => {
    expect(
      shouldFireOncePerDay({
        enabled: true, now: sun1030, targetMinutes: 600, lastSentDayKey: '', doneDayKey: '2026-07-12',
      }),
    ).toBe(false)
    expect(
      shouldFireOncePerDay({
        enabled: true, now: sun1030, targetMinutes: 600, lastSentDayKey: '2026-07-12',
      }),
    ).toBe(false)
  })
  it('does not fire before the time, when disabled, or with no target', () => {
    expect(shouldFireOncePerDay({ enabled: true, now: sun0900, targetMinutes: 600, lastSentDayKey: '' })).toBe(false)
    expect(shouldFireOncePerDay({ enabled: false, now: sun1030, targetMinutes: 600, lastSentDayKey: '' })).toBe(false)
    expect(shouldFireOncePerDay({ enabled: true, now: sun1030, targetMinutes: null, lastSentDayKey: '' })).toBe(false)
  })
})

describe('shouldFireOncePerWeek', () => {
  it('fires on the right weekday, past the slot, not sent this week', () => {
    expect(
      shouldFireOncePerWeek({ enabled: true, now: sun1030, dow: 0, targetMinutes: 600, lastSentWeekKey: '' }),
    ).toBe(true)
  })
  it('is suppressed on the wrong day, before the time, or already sent', () => {
    expect(
      shouldFireOncePerWeek({ enabled: true, now: sun1030, dow: 1, targetMinutes: 600, lastSentWeekKey: '' }),
    ).toBe(false)
    expect(
      shouldFireOncePerWeek({ enabled: true, now: sun0900, dow: 0, targetMinutes: 600, lastSentWeekKey: '' }),
    ).toBe(false)
  })
})

describe('shouldFireOncePerId', () => {
  it('fires when ready and not yet sent for that id', () => {
    expect(shouldFireOncePerId({ enabled: true, ready: true, id: 'a', lastSentId: '' })).toBe(true)
    expect(shouldFireOncePerId({ enabled: true, ready: true, id: 'a', lastSentId: 'a' })).toBe(false)
    expect(shouldFireOncePerId({ enabled: true, ready: false, id: 'a', lastSentId: '' })).toBe(false)
    expect(shouldFireOncePerId({ enabled: false, ready: true, id: 'a', lastSentId: '' })).toBe(false)
  })
})
