import { describe, it, expect } from 'vitest'
import { lengthBucketOf, isInLengthBucket, LENGTH_BUCKETS } from './lengthBuckets'

describe('lengthBucketOf', () => {
  it('returns null for missing/invalid hours', () => {
    expect(lengthBucketOf(null)).toBeNull()
    expect(lengthBucketOf(undefined)).toBeNull()
    expect(lengthBucketOf(NaN)).toBeNull()
  })

  it('buckets Short as under 4h', () => {
    expect(lengthBucketOf(0)).toBe('Short')
    expect(lengthBucketOf(3.9)).toBe('Short')
  })

  it('buckets Medium as 4h up to (not including) 12h', () => {
    expect(lengthBucketOf(4)).toBe('Medium')
    expect(lengthBucketOf(11.9)).toBe('Medium')
  })

  it('buckets Long as 12h up to (not including) 25h', () => {
    expect(lengthBucketOf(12)).toBe('Long')
    expect(lengthBucketOf(24.9)).toBe('Long')
  })

  it('buckets Epic as 25h and up', () => {
    expect(lengthBucketOf(25)).toBe('Epic')
    expect(lengthBucketOf(100)).toBe('Epic')
  })
})

describe('isInLengthBucket', () => {
  it('is false for a game with no recorded length', () => {
    expect(isInLengthBucket({ lengthHours: null }, 'Short')).toBe(false)
    expect(isInLengthBucket({ lengthHours: undefined }, 'Short')).toBe(false)
  })

  it('matches the correct bucket', () => {
    expect(isInLengthBucket({ lengthHours: 8 }, 'Medium')).toBe(true)
    expect(isInLengthBucket({ lengthHours: 8 }, 'Short')).toBe(false)
  })
})

describe('LENGTH_BUCKETS', () => {
  it('defines the four documented buckets', () => {
    expect(Object.keys(LENGTH_BUCKETS)).toEqual(['Short', 'Medium', 'Long', 'Epic'])
  })
})
