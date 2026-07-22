import { describe, it, expect } from 'vitest'
import { normalizeTagForDriftCheck, findNearDuplicateTags } from './tagDrift'
import { ALL_TAGS } from './seed-data'

describe('normalizeTagForDriftCheck', () => {
  it('collapses ampersand/whitespace/case variants to the same key', () => {
    expect(normalizeTagForDriftCheck('Point & Click')).toBe(normalizeTagForDriftCheck('point and click'))
    expect(normalizeTagForDriftCheck('Dark Humor')).toBe(normalizeTagForDriftCheck('dark-humor'))
  })

  it('keeps genuinely distinct tags apart', () => {
    expect(normalizeTagForDriftCheck('History')).not.toBe(normalizeTagForDriftCheck('Historical'))
  })
})

describe('findNearDuplicateTags', () => {
  it('flags a near-duplicate pair', () => {
    const groups = findNearDuplicateTags(['Point & Click', 'Point and Click', 'Comedy'])
    expect(groups).toEqual([['Point & Click', 'Point and Click']])
  })

  it('returns an empty array when nothing collides', () => {
    expect(findNearDuplicateTags(['Comedy', 'Horror', 'Mystery'])).toEqual([])
  })
})

// Regression guard: ALL_TAGS itself must never accumulate a near-duplicate as
// it grows — this is exactly the guard the R2 design decision asked for
// ("curate/expand ALL_TAGS with a drift guard").
describe('ALL_TAGS has no internal near-duplicates', () => {
  it('every tag normalizes to a unique key', () => {
    expect(findNearDuplicateTags(ALL_TAGS)).toEqual([])
  })
})
