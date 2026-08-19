import { describe, it, expect } from 'vitest'
import { daysSince, daysRemaining, isExpired, fadeRatio, todayIso, DEFAULT_SEASON_DAYS } from './understory'

const TODAY = new Date('2026-06-01T12:00:00')

describe('daysSince', () => {
  it('is zero for today', () => {
    expect(daysSince('2026-06-01', TODAY)).toBe(0)
  })

  it('counts whole days, ignoring time-of-day on either side', () => {
    expect(daysSince('2026-05-01', TODAY)).toBe(31)
  })
})

describe('daysRemaining', () => {
  it('counts down from the season length', () => {
    expect(daysRemaining({ encountered: '2026-05-01' }, 90, TODAY)).toBe(90 - 31)
  })

  it('goes negative once the season has fully elapsed', () => {
    expect(daysRemaining({ encountered: '2026-01-01' }, 90, TODAY)).toBeLessThan(0)
  })
})

describe('isExpired', () => {
  it('is false while still inside the season', () => {
    expect(isExpired({ encountered: '2026-05-15', state: 'Understory' }, 90, TODAY)).toBe(false)
  })

  it('is true once the season has fully elapsed and it is still Understory', () => {
    expect(isExpired({ encountered: '2026-01-01', state: 'Understory' }, 90, TODAY)).toBe(true)
  })

  it('is true exactly on the season boundary (0 days remaining)', () => {
    const boundary = new Date('2026-05-01T12:00:00')
    expect(isExpired({ encountered: '2026-02-01', state: 'Understory' }, 89, boundary)).toBe(true)
  })

  it('is never true for a thing that already left the understory', () => {
    expect(isExpired({ encountered: '2026-01-01', state: 'Kept' }, 90, TODAY)).toBe(false)
    expect(isExpired({ encountered: '2026-01-01', state: 'Released' }, 90, TODAY)).toBe(false)
  })

  it('defaults to a 90-day season', () => {
    expect(DEFAULT_SEASON_DAYS).toBe(90)
  })
})

describe('fadeRatio', () => {
  it('is 1 for something encountered today', () => {
    expect(fadeRatio({ encountered: '2026-06-01' }, 90, TODAY)).toBe(1)
  })

  it('is 0 once past the season, clamped rather than negative', () => {
    expect(fadeRatio({ encountered: '2026-01-01' }, 90, TODAY)).toBe(0)
  })

  it('is between 0 and 1 partway through the season', () => {
    const ratio = fadeRatio({ encountered: '2026-05-01' }, 90, TODAY)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })
})

describe('todayIso', () => {
  // The bug this exists to prevent: `new Date().toISOString().slice(0, 10)`
  // returns the UTC date, so anyone east of UTC gets "yesterday" stamped
  // until the offset has passed. Every date this app writes (kept, coined,
  // made, the walk's daily seed, the seen-history bucket, the provocation
  // gate's quiet-week clock) reasons in the LOCAL calendar day, so the
  // write and the read were quietly a day apart.
  it('returns the local calendar date, not the UTC one', () => {
    // 00:30 local on the 20th, in a zone 3 hours ahead of UTC — UTC still
    // says the 19th.
    const justAfterLocalMidnight = new Date('2026-08-19T21:30:00Z')
    const asUtc = justAfterLocalMidnight.toISOString().slice(0, 10)
    const local = todayIso(justAfterLocalMidnight)

    if (justAfterLocalMidnight.getTimezoneOffset() < 0) {
      // Runner is east of UTC (e.g. Europe/Bucharest) — the case the bug bit.
      expect(local).not.toBe(asUtc)
      expect(local).toBe('2026-08-20')
    }
    // Whatever the runner's own zone, the answer always matches its clock.
    const y = justAfterLocalMidnight.getFullYear()
    const m = String(justAfterLocalMidnight.getMonth() + 1).padStart(2, '0')
    const d = String(justAfterLocalMidnight.getDate()).padStart(2, '0')
    expect(local).toBe(`${y}-${m}-${d}`)
  })

  it('round-trips through daysSince as zero days elapsed', () => {
    const now = new Date()
    expect(daysSince(todayIso(now), now)).toBe(0)
  })
})
