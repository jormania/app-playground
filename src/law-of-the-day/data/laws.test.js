import { describe, it, expect } from 'vitest'
import laws from './laws.json'

describe('laws.json', () => {
  it('has exactly 48 entries', () => {
    expect(laws).toHaveLength(48)
  })

  it('has unique ids 1 through 48', () => {
    const ids = laws.map((l) => l.id).sort((a, b) => a - b)
    expect(ids).toEqual(Array.from({ length: 48 }, (_, i) => i + 1))
  })

  it('has lawNumber equal to id for every entry', () => {
    for (const law of laws) {
      expect(law.lawNumber).toBe(law.id)
    }
  })

  it('has a non-empty lawTitle for every entry', () => {
    for (const law of laws) {
      expect(typeof law.lawTitle).toBe('string')
      expect(law.lawTitle.trim().length).toBeGreaterThan(0)
    }
  })

  it('has 3-5 decoyLawIds per entry, excluding its own id', () => {
    for (const law of laws) {
      expect(law.decoyLawIds.length).toBeGreaterThanOrEqual(3)
      expect(law.decoyLawIds.length).toBeLessThanOrEqual(5)
      expect(law.decoyLawIds).not.toContain(law.id)
    }
  })

  it('has decoyLawIds that all resolve to real laws', () => {
    const validIds = new Set(laws.map((l) => l.id))
    for (const law of laws) {
      for (const decoyId of law.decoyLawIds) {
        expect(validIds.has(decoyId)).toBe(true)
      }
    }
  })

  it('has non-empty scenarioText and explanationText for every entry', () => {
    for (const law of laws) {
      expect(law.scenarioText.trim().length).toBeGreaterThanOrEqual(20)
      expect(law.explanationText.trim().length).toBeGreaterThanOrEqual(20)
    }
  })
})
