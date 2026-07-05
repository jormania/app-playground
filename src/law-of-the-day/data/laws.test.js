import { describe, it, expect } from 'vitest'
import laws from './laws.json'
import { scenarioLeaksTitle } from '../lib/leakCheck'

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

  it('has a non-empty family for every entry', () => {
    for (const law of laws) {
      expect(typeof law.family).toBe('string')
      expect(law.family.trim().length).toBeGreaterThan(0)
    }
  })

  it('has every family large enough to source 3 same-family distractors', () => {
    const counts = {}
    for (const law of laws) counts[law.family] = (counts[law.family] || 0) + 1
    for (const [family, count] of Object.entries(counts)) {
      // family size minus the correct law must leave at least 3 candidates
      expect(count, `family "${family}"`).toBeGreaterThanOrEqual(4)
    }
  })

  it('has no scenario that leaks a distinctive word from its own title', () => {
    for (const law of laws) {
      const leaks = scenarioLeaksTitle(law.scenarioText, law.lawTitle)
      expect(leaks, `Law ${law.id} "${law.lawTitle}" leaks: ${leaks.join(', ')}`).toEqual([])
    }
  })
})
