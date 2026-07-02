import { describe, it, expect } from 'vitest'
import { buildOptions, gradeAnswer } from './quiz'

const laws = [
  { id: 1, lawTitle: 'Law One', decoyLawIds: [2, 3, 4] },
  { id: 2, lawTitle: 'Law Two', decoyLawIds: [] },
  { id: 3, lawTitle: 'Law Three', decoyLawIds: [] },
  { id: 4, lawTitle: 'Law Four', decoyLawIds: [] },
  { id: 5, lawTitle: 'Law Five', decoyLawIds: [] },
  { id: 6, lawTitle: 'Law Six', decoyLawIds: [] },
]

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

describe('gradeAnswer', () => {
  it('is correct when the selected id matches', () => {
    expect(gradeAnswer(3, 3)).toBe(true)
  })

  it('is incorrect when the selected id differs', () => {
    expect(gradeAnswer(3, 4)).toBe(false)
  })
})
