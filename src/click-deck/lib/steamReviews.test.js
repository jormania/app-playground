import { describe, it, expect } from 'vitest'
import {
  wilsonLowerBound, steamReviewScore, wasReviewChecked, hasReviewData,
  reviewBucketOf, isInReviewBucket, reviewAccentColor, REVIEW_BUCKETS
} from './steamReviews'

describe('wilsonLowerBound', () => {
  it('returns null for zero or missing review count', () => {
    expect(wilsonLowerBound(100, 0)).toBeNull()
    expect(wilsonLowerBound(100, null)).toBeNull()
    expect(wilsonLowerBound(100, undefined)).toBeNull()
  })

  it('discounts a tiny sample below a large sample with a slightly lower raw percentage (the motivating case)', () => {
    const tinySample = wilsonLowerBound(100, 4) // 100% positive, 4 reviews
    const hugeSample = wilsonLowerBound(94, 50000) // 94% positive, 50k reviews
    expect(tinySample).toBeLessThan(hugeSample)
  })

  it('scores a large 100% sample higher than a small 100% sample', () => {
    const small = wilsonLowerBound(100, 5)
    const large = wilsonLowerBound(100, 5000)
    expect(large).toBeGreaterThan(small)
  })

  it('stays within [0, 1]', () => {
    expect(wilsonLowerBound(0, 1)).toBeGreaterThanOrEqual(0)
    expect(wilsonLowerBound(100, 1)).toBeLessThanOrEqual(1)
    expect(wilsonLowerBound(50, 1000000)).toBeLessThanOrEqual(1)
  })
})

describe('steamReviewScore', () => {
  it('returns null when the game has never been checked', () => {
    expect(steamReviewScore({})).toBeNull()
    expect(steamReviewScore({ steamReviewCount: undefined })).toBeNull()
  })

  it('returns null when checked but Steam reported zero reviews', () => {
    expect(steamReviewScore({ reviewCheckedAt: '2026-07-24', steamReviewCount: 0, steamReviewPercent: 0 })).toBeNull()
  })

  it('computes a score for a game with real review data', () => {
    const score = steamReviewScore({ reviewCheckedAt: '2026-07-24', steamReviewPercent: 95, steamReviewCount: 9586 })
    expect(score).toBeGreaterThan(0.9)
  })
})

describe('wasReviewChecked / hasReviewData', () => {
  it('distinguishes never-checked from checked-but-empty from checked-with-data', () => {
    const neverChecked = {}
    const checkedEmpty = { reviewCheckedAt: '2026-07-24', steamReviewCount: 0 }
    const checkedWithData = { reviewCheckedAt: '2026-07-24', steamReviewCount: 10, steamReviewPercent: 80 }

    expect(wasReviewChecked(neverChecked)).toBe(false)
    expect(wasReviewChecked(checkedEmpty)).toBe(true)
    expect(wasReviewChecked(checkedWithData)).toBe(true)

    expect(hasReviewData(neverChecked)).toBe(false)
    expect(hasReviewData(checkedEmpty)).toBe(false)
    expect(hasReviewData(checkedWithData)).toBe(true)
  })
})

describe('reviewBucketOf', () => {
  it('buckets by the ROUNDED percentage at the documented boundaries', () => {
    expect(reviewBucketOf(100)).toBe('Acclaimed')
    expect(reviewBucketOf(90)).toBe('Acclaimed')
    expect(reviewBucketOf(89.4)).toBe('Positive') // rounds to 89, stays under
    expect(reviewBucketOf(75)).toBe('Positive')
    expect(reviewBucketOf(74.4)).toBe('Mixed') // rounds to 74, stays under
    expect(reviewBucketOf(50)).toBe('Mixed')
    expect(reviewBucketOf(49.4)).toBe('Negative') // rounds to 49, stays under
    expect(reviewBucketOf(0)).toBe('Negative')
  })

  it('rounds a value UP across a bucket boundary rather than comparing the raw float — the confirmed live bug (89.7495% displayed "90%" but bucketed as Positive)', () => {
    expect(reviewBucketOf(89.7495361781076)).toBe('Acclaimed') // displays "90%" — must match
    expect(reviewBucketOf(89.9)).toBe('Acclaimed')
    expect(reviewBucketOf(74.9)).toBe('Positive')
    expect(reviewBucketOf(49.9)).toBe('Mixed')
  })

  it('returns null for missing/invalid input', () => {
    expect(reviewBucketOf(null)).toBeNull()
    expect(reviewBucketOf(undefined)).toBeNull()
    expect(reviewBucketOf(NaN)).toBeNull()
  })

  it('every bucket key has a label in REVIEW_BUCKETS', () => {
    for (const key of ['Acclaimed', 'Positive', 'Mixed', 'Negative']) {
      expect(REVIEW_BUCKETS[key].label).toBeTruthy()
    }
  })
})

describe('isInReviewBucket', () => {
  it('is false for a game with no review data regardless of bucket', () => {
    expect(isInReviewBucket({}, 'Acclaimed')).toBe(false)
    expect(isInReviewBucket({ reviewCheckedAt: '2026-07-24', steamReviewCount: 0 }, 'Negative')).toBe(false)
  })

  it('matches the bucket for a game with real data', () => {
    const game = { reviewCheckedAt: '2026-07-24', steamReviewCount: 100, steamReviewPercent: 95 }
    expect(isInReviewBucket(game, 'Acclaimed')).toBe(true)
    expect(isInReviewBucket(game, 'Mixed')).toBe(false)
  })
})

describe('reviewAccentColor', () => {
  it('maps each bucket to a distinct theme accent var, not a hardcoded Steam-style hex', () => {
    expect(reviewAccentColor(95)).toBe('var(--cd-accent-cyan)')
    expect(reviewAccentColor(80)).toBe('var(--cd-accent-amber)')
    expect(reviewAccentColor(60)).toBe('var(--cd-text-muted)')
    expect(reviewAccentColor(20)).toBe('var(--cd-status-abandoned)')
  })

  it('falls back to muted for no data', () => {
    expect(reviewAccentColor(null)).toBe('var(--cd-text-muted)')
  })
})
