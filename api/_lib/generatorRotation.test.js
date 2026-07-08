import { describe, it, expect } from 'vitest'
import { getGeneratorLawId } from './generatorRotation'

describe('getGeneratorLawId', () => {
  it('returns a value in range 1-48', () => {
    const id = getGeneratorLawId(new Date(2026, 5, 15))
    expect(id).toBeGreaterThanOrEqual(1)
    expect(id).toBeLessThanOrEqual(48)
  })

  it('is deterministic for the same date', () => {
    const date = new Date(2026, 3, 10)
    expect(getGeneratorLawId(date)).toBe(getGeneratorLawId(date))
  })

  it('cycles through all 48 ids with no repeats over 48 consecutive days', () => {
    const start = new Date(Date.UTC(2026, 0, 1))
    const seen = new Set()
    for (let i = 0; i < 48; i++) {
      const day = new Date(start.getTime() + i * 86400000)
      seen.add(getGeneratorLawId(day))
    }
    expect(seen.size).toBe(48)
  })

  it('wraps back to the same sequence after a full 48-day cycle', () => {
    const day1 = new Date(Date.UTC(2026, 0, 1))
    const dayWrapped = new Date(day1.getTime() + 48 * 86400000)
    expect(getGeneratorLawId(dayWrapped)).toBe(getGeneratorLawId(day1))
  })

  it('handles dates before the epoch without throwing or going out of range', () => {
    const before = new Date(Date.UTC(2025, 11, 1))
    const id = getGeneratorLawId(before)
    expect(id).toBeGreaterThanOrEqual(1)
    expect(id).toBeLessThanOrEqual(48)
  })
})
