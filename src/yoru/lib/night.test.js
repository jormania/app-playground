import { describe, it, expect } from 'vitest'
import { nightKey, sameNight } from './night'

// Build a local-time timestamp so the 4am rollover is exercised in the runner's
// own zone (nightKey uses local getHours/getDate).
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).getTime()

describe('nightKey', () => {
  it('keys an evening to that calendar date', () => {
    expect(nightKey(at(2026, 7, 7, 22, 30))).toBe('2026-07-07')
  })
  it('keeps the small hours (before 4am) on the previous night', () => {
    expect(nightKey(at(2026, 7, 8, 0, 40))).toBe('2026-07-07')
    expect(nightKey(at(2026, 7, 8, 3, 59))).toBe('2026-07-07')
  })
  it('rolls to the new night at 4am', () => {
    expect(nightKey(at(2026, 7, 8, 4, 0))).toBe('2026-07-08')
  })
})

describe('sameNight', () => {
  it('groups an evening and its following small hours together', () => {
    expect(sameNight(at(2026, 7, 7, 23, 0), at(2026, 7, 8, 1, 0))).toBe(true)
  })
  it('separates two different nights', () => {
    expect(sameNight(at(2026, 7, 7, 23, 0), at(2026, 7, 8, 23, 0))).toBe(false)
  })
})
