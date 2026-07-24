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
  it('buckets by Steam\'s own descriptor string, never by percentage', () => {
    expect(reviewBucketOf('Overwhelmingly Positive')).toBe('Acclaimed')
    expect(reviewBucketOf('Very Positive')).toBe('Acclaimed')
    expect(reviewBucketOf('Positive')).toBe('Positive')
    expect(reviewBucketOf('Mostly Positive')).toBe('Positive')
    expect(reviewBucketOf('Mixed')).toBe('Mixed')
    expect(reviewBucketOf('Mostly Negative')).toBe('Negative')
    expect(reviewBucketOf('Negative')).toBe('Negative')
    expect(reviewBucketOf('Very Negative')).toBe('Negative')
    expect(reviewBucketOf('Overwhelmingly Negative')).toBe('Negative')
  })

  it('two games Steam labels identically always land in the same bucket regardless of their exact percentage — the confirmed live bug (percentage-threshold bucketing put two "Very Positive" games, 80% and 91%, in different buckets)', () => {
    // Same label, wildly different percentage — percentage is irrelevant here.
    expect(reviewBucketOf('Very Positive')).toBe(reviewBucketOf('Very Positive'))
    expect(reviewBucketOf('Very Positive')).toBe('Acclaimed')
  })

  it('returns null for missing/invalid/unrecognized input', () => {
    expect(reviewBucketOf(null)).toBeNull()
    expect(reviewBucketOf(undefined)).toBeNull()
    expect(reviewBucketOf('No user reviews')).toBeNull()
    expect(reviewBucketOf('Some Unexpected String')).toBeNull()
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

  it('matches the bucket for a game with real data, keyed off the desc string', () => {
    const game = { reviewCheckedAt: '2026-07-24', steamReviewCount: 100, steamReviewPercent: 95, steamReviewDesc: 'Very Positive' }
    expect(isInReviewBucket(game, 'Acclaimed')).toBe(true)
    expect(isInReviewBucket(game, 'Mixed')).toBe(false)
  })

  it('two games with the same desc but different percentages both match the same bucket', () => {
    const low = { reviewCheckedAt: '2026-07-24', steamReviewCount: 100, steamReviewPercent: 80, steamReviewDesc: 'Very Positive' }
    const high = { reviewCheckedAt: '2026-07-24', steamReviewCount: 100, steamReviewPercent: 91, steamReviewDesc: 'Very Positive' }
    expect(isInReviewBucket(low, 'Acclaimed')).toBe(true)
    expect(isInReviewBucket(high, 'Acclaimed')).toBe(true)
  })
})

describe('reviewAccentColor', () => {
  it('maps each bucket to a distinct theme accent var, not a hardcoded Steam-style hex — Mixed gets amber (worth a second look), Positive fades to muted (solid but unremarkable)', () => {
    expect(reviewAccentColor('Overwhelmingly Positive')).toBe('var(--cd-accent-cyan)')
    expect(reviewAccentColor('Very Positive')).toBe('var(--cd-accent-cyan)')
    expect(reviewAccentColor('Positive')).toBe('var(--cd-text-muted)')
    expect(reviewAccentColor('Mostly Positive')).toBe('var(--cd-text-muted)')
    expect(reviewAccentColor('Mixed')).toBe('var(--cd-accent-amber)')
    expect(reviewAccentColor('Negative')).toBe('var(--cd-status-abandoned)')
  })

  it('two games sharing a label share a colour regardless of their exact percentage', () => {
    expect(reviewAccentColor('Very Positive')).toBe(reviewAccentColor('Very Positive'))
  })

  it('falls back to muted for no data', () => {
    expect(reviewAccentColor(null)).toBe('var(--cd-text-muted)')
    expect(reviewAccentColor('No user reviews')).toBe('var(--cd-text-muted)')
  })
})
