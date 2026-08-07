import { describe, it, expect } from 'vitest'
import { todayIso } from './today.ts'

describe('todayIso', () => {
  it('pads month and day', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('does not shift near midnight the way UTC conversion would', () => {
    // 2026-08-06 23:30 local must stay the 6th, not roll to the 7th.
    expect(todayIso(new Date(2026, 7, 6, 23, 30))).toBe('2026-08-06')
  })

  it('defaults to right now when no date is given', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
