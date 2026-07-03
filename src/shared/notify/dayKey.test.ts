import { describe, it, expect } from 'vitest'
import { dayKey, minutesOfDay, weekKey, nextMidnight } from './dayKey'

describe('dayKey', () => {
  it('formats local YYYY-MM-DD, zero-padded', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('minutesOfDay', () => {
  it('converts local hours/minutes to minutes since midnight', () => {
    expect(minutesOfDay(new Date(2026, 0, 1, 0, 0))).toBe(0)
    expect(minutesOfDay(new Date(2026, 0, 1, 10, 30))).toBe(630)
    expect(minutesOfDay(new Date(2026, 0, 1, 23, 59))).toBe(1439)
  })
})

describe('weekKey', () => {
  it('gives the same key for days in the same ISO week', () => {
    const mon = new Date(2026, 6, 6) // Monday
    const sun = new Date(2026, 6, 12) // Sunday, same week
    expect(weekKey(mon)).toBe(weekKey(sun))
  })
  it('differs across a week boundary', () => {
    const thisWeek = new Date(2026, 6, 12)
    const nextWeek = new Date(2026, 6, 13)
    expect(weekKey(thisWeek)).not.toBe(weekKey(nextWeek))
  })
})

describe('nextMidnight', () => {
  it('is the start of the following local day', () => {
    const now = new Date(2026, 6, 12, 15, 30)
    const mid = new Date(nextMidnight(now))
    expect(mid.getDate()).toBe(13)
    expect(mid.getHours()).toBe(0)
    expect(mid.getMinutes()).toBe(0)
  })
})
