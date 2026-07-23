import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchReviewSummary, buildReviewPatchProperties, isReviewCheckStale, REVIEW_RECHECK_DAYS } from './clickdeckReviews.js'

describe('fetchReviewSummary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns null for a missing appId (no request made)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchReviewSummary(null)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchReviewSummary(4582880)).toBeNull()
  })

  it('returns null when Steam reports success: 0 or a missing query_summary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: 0 }) }))
    expect(await fetchReviewSummary(4582880)).toBeNull()
  })

  it('returns null on a network error rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchReviewSummary(4582880)).toBeNull()
  })

  it('returns a real zero-review result (not null) for a genuinely unreviewed/unreleased game — this is a successful check, not a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 1, query_summary: { total_reviews: 0, total_positive: 0, review_score_desc: 'No user reviews' } })
    }))
    const summary = await fetchReviewSummary(4582880)
    expect(summary).toEqual({ percent: 0, count: 0, desc: 'No user reviews' })
  })

  it('computes percent from total_positive/total_reviews for a real result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 1, query_summary: { total_reviews: 9586, total_positive: 9119, total_negative: 467, review_score_desc: 'Overwhelmingly Positive' } })
    }))
    const summary = await fetchReviewSummary(1205520)
    expect(summary.count).toBe(9586)
    expect(summary.desc).toBe('Overwhelmingly Positive')
    expect(summary.percent).toBeCloseTo((9119 / 9586) * 100, 5)
  })
})

describe('buildReviewPatchProperties', () => {
  it('always stamps Review Checked At and writes all three review fields', () => {
    const now = new Date('2026-07-24T00:00:00.000Z')
    const props = buildReviewPatchProperties({ percent: 95.1, count: 9586, desc: 'Overwhelmingly Positive' }, now)
    expect(props['Review Checked At']).toEqual({ date: { start: now.toISOString() } })
    expect(props['Steam Review %']).toEqual({ number: 95.1 })
    expect(props['Steam Review Count']).toEqual({ number: 9586 })
    expect(props['Steam Review Desc']).toEqual({ rich_text: [{ text: { content: 'Overwhelmingly Positive' } }] })
  })

  it('writes an empty rich_text array for a blank desc rather than omitting the property', () => {
    const props = buildReviewPatchProperties({ percent: 0, count: 0, desc: '' })
    expect(props['Steam Review Desc']).toEqual({ rich_text: [] })
  })
})

describe('isReviewCheckStale', () => {
  const now = new Date('2026-07-24T00:00:00.000Z')

  it('is stale when never checked', () => {
    expect(isReviewCheckStale(null, now)).toBe(true)
    expect(isReviewCheckStale(undefined, now)).toBe(true)
  })

  it(`is fresh just under ${REVIEW_RECHECK_DAYS} days`, () => {
    const recent = new Date(now.getTime() - (REVIEW_RECHECK_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewCheckStale(recent, now)).toBe(false)
  })

  it(`is stale at exactly ${REVIEW_RECHECK_DAYS} days`, () => {
    const exact = new Date(now.getTime() - REVIEW_RECHECK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    expect(isReviewCheckStale(exact, now)).toBe(true)
  })
})
