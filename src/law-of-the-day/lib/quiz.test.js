import { describe, it, expect } from 'vitest'
import { buildOptions, gradeAnswer, adaptiveBoost } from './quiz'

const laws = [
  { id: 1, lawTitle: 'Law One', decoyLawIds: [2, 3, 4] },
  { id: 2, lawTitle: 'Law Two', decoyLawIds: [] },
  { id: 3, lawTitle: 'Law Three', decoyLawIds: [] },
  { id: 4, lawTitle: 'Law Four', decoyLawIds: [] },
  { id: 5, lawTitle: 'Law Five', decoyLawIds: [] },
  { id: 6, lawTitle: 'Law Six', decoyLawIds: [] },
]

// A pool with families for exercising the harder tiers: law 1's family "alpha"
// has members 1,2,3,7,8; curated decoys point outside the family (10,11).
const familyLaws = [
  { id: 1, lawTitle: 'Law One', decoyLawIds: [10, 11], family: 'alpha' },
  { id: 2, lawTitle: 'Law Two', decoyLawIds: [], family: 'alpha' },
  { id: 3, lawTitle: 'Law Three', decoyLawIds: [], family: 'alpha' },
  { id: 7, lawTitle: 'Law Seven', decoyLawIds: [], family: 'alpha' },
  { id: 8, lawTitle: 'Law Eight', decoyLawIds: [], family: 'alpha' },
  { id: 10, lawTitle: 'Law Ten', decoyLawIds: [], family: 'beta' },
  { id: 11, lawTitle: 'Law Eleven', decoyLawIds: [], family: 'beta' },
  { id: 12, lawTitle: 'Law Twelve', decoyLawIds: [], family: 'gamma' },
]
const alphaAndCurated = new Set([2, 3, 7, 8, 10, 11])

describe('buildOptions', () => {
  it('includes the correct law plus exactly 3 decoys when the pool has 3', () => {
    const options = buildOptions(laws[0], laws)
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('samples only 3 decoys when the pool is larger, keeping options at 4 total', () => {
    const lawWithBigPool = { id: 1, lawTitle: 'Law One', decoyLawIds: [2, 3, 4, 5, 6] }
    const options = buildOptions(lawWithBigPool, laws)
    expect(options).toHaveLength(4)
    const decoyIds = options.map((o) => o.id).filter((id) => id !== 1)
    expect(decoyIds).toHaveLength(3)
    for (const id of decoyIds) {
      expect([2, 3, 4, 5, 6]).toContain(id)
    }
  })

  it('has no duplicate options', () => {
    const options = buildOptions(laws[0], laws)
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length)
  })

  it('ignores a decoy id that does not resolve to a real law', () => {
    const lawWithBadDecoy = { id: 1, lawTitle: 'Law One', decoyLawIds: [2, 999] }
    const options = buildOptions(lawWithBadDecoy, laws)
    expect(options.map((o) => o.id).sort()).toEqual([1, 2])
  })

  it('returns { id, title } shaped options', () => {
    const options = buildOptions(laws[0], laws)
    for (const opt of options) {
      expect(opt).toHaveProperty('id')
      expect(opt).toHaveProperty('title')
    }
  })
})

describe('buildOptions — complex tier', () => {
  const opts = { difficulty: 'complex' }

  it('draws all 3 distractors from curated ∪ same-family laws', () => {
    for (let i = 0; i < 50; i++) {
      const options = buildOptions(familyLaws[0], familyLaws, opts)
      expect(options).toHaveLength(4)
      const decoyIds = options.map((o) => o.id).filter((id) => id !== 1)
      expect(decoyIds).toHaveLength(3)
      for (const id of decoyIds) expect(alphaAndCurated.has(id)).toBe(true)
    }
  })

  it('never surfaces an unrelated (different-family, non-curated) law', () => {
    for (let i = 0; i < 50; i++) {
      const ids = buildOptions(familyLaws[0], familyLaws, opts).map((o) => o.id)
      expect(ids).not.toContain(12)
    }
  })

  it('tops up from the full deck when the close pool is too small', () => {
    const lonely = { id: 99, lawTitle: 'Lonely', decoyLawIds: [], family: 'nobody' }
    const options = buildOptions(lonely, [lonely, ...familyLaws], opts)
    expect(options).toHaveLength(4)
    expect(new Set(options.map((o) => o.id)).size).toBe(4)
  })
})

describe('buildOptions — extreme tier', () => {
  it('keeps distractors within curated ∪ same-family', () => {
    for (let i = 0; i < 50; i++) {
      const decoyIds = buildOptions(familyLaws[0], familyLaws, { difficulty: 'extreme' })
        .map((o) => o.id)
        .filter((id) => id !== 1)
      for (const id of decoyIds) expect(alphaAndCurated.has(id)).toBe(true)
    }
  })

  it('leans toward a same-family law the user reliably misses', () => {
    // Law 8 is always missed; law 2/3/7 are neutral. Across many draws the
    // adaptive weighting should surface law 8 far more often than chance.
    const history = { 8: { correctCount: 0, incorrectCount: 6, lastAnsweredCorrect: false } }
    let with8 = 0
    const runs = 300
    for (let i = 0; i < runs; i++) {
      const ids = buildOptions(familyLaws[0], familyLaws, { difficulty: 'extreme', history }).map((o) => o.id)
      if (ids.includes(8)) with8++
    }
    // Curated (10,11) always score highest and take 2 of 3 slots; the last slot
    // goes to a family member, where law 8's boost makes it the clear favorite.
    expect(with8 / runs).toBeGreaterThan(0.7)
  })
})

describe('adaptiveBoost', () => {
  it('is zero for a law with no history', () => {
    expect(adaptiveBoost(5, {})).toBe(0)
  })

  it('grows with miss rate and a recent miss', () => {
    const rarelyMissed = { 1: { correctCount: 9, incorrectCount: 1, lastAnsweredCorrect: true } }
    const oftenMissed = { 1: { correctCount: 1, incorrectCount: 9, lastAnsweredCorrect: false } }
    expect(adaptiveBoost(1, oftenMissed)).toBeGreaterThan(adaptiveBoost(1, rarelyMissed))
  })
})

describe('gradeAnswer', () => {
  it('is correct when the selected id matches', () => {
    expect(gradeAnswer(3, 3)).toBe(true)
  })

  it('is incorrect when the selected id differs', () => {
    expect(gradeAnswer(3, 4)).toBe(false)
  })
})
