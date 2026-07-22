import { describe, it, expect } from 'vitest'
import { isCompletedWithinDays, countUndatedCompleted, COMPLETION_WINDOWS } from './completionTracking'

const DAY = 24 * 60 * 60 * 1000

describe('isCompletedWithinDays', () => {
  const now = new Date('2026-07-22T00:00:00.000Z').getTime()

  it('is false for a non-Completed game even with a completedAt', () => {
    expect(isCompletedWithinDays({ status: 'Playing', completedAt: '2026-07-20' }, 30, now)).toBe(false)
  })

  it('is false for a Completed game with no completedAt (undated)', () => {
    expect(isCompletedWithinDays({ status: 'Completed', completedAt: null }, 30, now)).toBe(false)
  })

  it('is true when completedAt falls inside the window', () => {
    expect(isCompletedWithinDays({ status: 'Completed', completedAt: '2026-07-10' }, 30, now)).toBe(true)
  })

  it('is false when completedAt falls outside the window', () => {
    expect(isCompletedWithinDays({ status: 'Completed', completedAt: '2026-01-01' }, 30, now)).toBe(false)
  })

  it('rejects a future-dated completedAt as not recent', () => {
    expect(isCompletedWithinDays({ status: 'Completed', completedAt: '2026-08-01' }, 30, now)).toBe(false)
  })

  it('is inclusive at the exact boundary', () => {
    const exactly30DaysAgo = new Date(now - 30 * DAY).toISOString().slice(0, 10)
    expect(isCompletedWithinDays({ status: 'Completed', completedAt: exactly30DaysAgo }, 30, now)).toBe(true)
  })
})

describe('countUndatedCompleted', () => {
  it('counts only Completed games missing completedAt', () => {
    const games = [
      { status: 'Completed', completedAt: '2026-07-01' },
      { status: 'Completed', completedAt: null },
      { status: 'Completed', completedAt: undefined },
      { status: 'Backlog', completedAt: null }
    ]
    expect(countUndatedCompleted(games)).toBe(2)
  })
})

describe('COMPLETION_WINDOWS', () => {
  it('defines the four documented windows in days', () => {
    expect(COMPLETION_WINDOWS).toEqual({ '1mo': 30, '3mo': 90, '6mo': 182, '12mo': 365 })
  })
})
