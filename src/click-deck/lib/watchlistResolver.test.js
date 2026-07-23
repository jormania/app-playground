import { describe, it, expect } from 'vitest'
import { parseYearFromReleaseDateString, resolveReleaseFlip, buildWatchlistUpdateFields } from './watchlistResolver'

// This is the client-side twin of api/_lib/clickdeckWatchlist.js — see that
// file's test for the full rule rationale; this just confirms the two
// copies actually agree on behavior.
describe('watchlistResolver (client-side twin)', () => {
  const now = new Date('2026-07-22T02:00:00.000Z')

  it('parses a year the same way as the server copy', () => {
    expect(parseYearFromReleaseDateString('15 Jul, 2026')).toBe(2026)
    expect(parseYearFromReleaseDateString('Coming soon')).toBeNull()
  })

  it('never flips a game that is not tracked as Coming Soon', () => {
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '1 Jan, 2019' } } }
    expect(resolveReleaseFlip({ releaseStatus: 'Released' }, appData, now)).toBeNull()
  })

  it('flips and stamps Released At exactly once when coming_soon becomes false, and records checkedAt', () => {
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, header_image: 'https://example.com/final.jpg' } }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon', tags: [], journal: '' }, appData, now)
    // The client twin also carries checkedAt (the server copy doesn't need it —
    // the cron already stamps Price Updated At through the pricing resolver;
    // the manual "Refresh Release Dates" path has no pricing pass, so it uses
    // checkedAt to keep [W]'s "last checked" staleness age honest).
    expect(resolved).toEqual({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026,
      releasedAt: now.toISOString(), checkedAt: now.toISOString(),
      coverUrl: 'https://example.com/final.jpg', derivedTags: null, derivedJournal: null, derivedDeveloper: null,
      reviewSummary: null
    })
  })

  it('carries a review summary through on flip when the server attached one to appData', () => {
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' } },
      reviewSummary: { percent: 92, count: 1500, desc: 'Very Positive' }
    }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon', tags: [], journal: '' }, appData, now)
    expect(resolved.reviewSummary).toEqual({ percent: 92, count: 1500, desc: 'Very Positive' })
  })

  it('a non-flip check still records checkedAt so the "last checked" age advances even when nothing launched', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'Q3 2026' }, header_image: 'https://example.com/dev.jpg' } }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now)
    expect(resolved).toEqual({ flipped: false, releaseDateString: 'Q3 2026', year: 2026, checkedAt: now.toISOString(), coverUrl: 'https://example.com/dev.jpg' })
  })

  it('normalizes Steam\'s "To be announced" to "TBA"', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'To be announced' } } }
    expect(resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now).releaseDateString).toBe('TBA')
  })

  it('on flip, derives tags (genre passthrough + description keyword matches) and journal from Steam when both are blank', () => {
    const appData = {
      success: true,
      data: {
        release_date: { coming_soon: false, date: '15 Jul, 2026' },
        genres: [{ description: 'Adventure' }, { description: 'Indie' }],
        short_description: 'A time-travel adventure.'
      }
    }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon', tags: [], journal: '' }, appData, now)
    expect(resolved.derivedTags).toEqual(['Adventure', 'Indie', 'Time Travel'])
    expect(resolved.derivedJournal).toBe('A time-travel adventure.')
  })

  it('on flip, never overwrites tags, journal or developer the game already has', () => {
    const appData = {
      success: true,
      data: {
        release_date: { coming_soon: false, date: '15 Jul, 2026' },
        genres: [{ description: 'Adventure' }],
        short_description: 'Marketing copy.',
        developers: ['Steam Studio']
      }
    }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon', tags: ['Point & Click'], journal: 'My own notes.', developer: 'Existing Studio' }, appData, now)
    expect(resolved.derivedTags).toBeNull()
    expect(resolved.derivedJournal).toBeNull()
    expect(resolved.derivedDeveloper).toBeNull()
  })

  it('on flip, derives developer from Steam when blank', () => {
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, developers: ['Wadjet Eye Games'] }
    }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon', tags: [], journal: '', developer: '' }, appData, now)
    expect(resolved.derivedDeveloper).toBe('Wadjet Eye Games')
  })

  it('buildWatchlistUpdateFields produces game-object fields (including priceUpdatedAt from checkedAt), not raw Notion properties', () => {
    const fields = buildWatchlistUpdateFields({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString(), checkedAt: now.toISOString(),
      coverUrl: 'https://example.com/final.jpg', derivedTags: ['Adventure'], derivedJournal: 'A time-travel adventure.', derivedDeveloper: 'Wadjet Eye Games'
    })
    expect(fields).toEqual({
      releaseDate: '15 Jul, 2026', priceUpdatedAt: now.toISOString(), year: 2026,
      coverUrl: 'https://example.com/final.jpg', releaseStatus: 'Released', releasedAt: now.toISOString(),
      tags: ['Adventure'], journal: 'A time-travel adventure.', developer: 'Wadjet Eye Games'
    })
  })

  it('a non-flip refresh updates the display fields + last-checked stamp + cover, leaving releaseStatus/releasedAt untouched', () => {
    const fields = buildWatchlistUpdateFields({ flipped: false, releaseDateString: 'Q3 2026', year: 2026, checkedAt: now.toISOString(), coverUrl: 'https://example.com/dev.jpg' })
    expect(fields).toEqual({ releaseDate: 'Q3 2026', priceUpdatedAt: now.toISOString(), year: 2026, coverUrl: 'https://example.com/dev.jpg' })
    expect(fields.releaseStatus).toBeUndefined()
    expect(fields.releasedAt).toBeUndefined()
  })

  it('includes Steam review fields (using checkedAt as reviewCheckedAt) when a review summary is present on flip', () => {
    const fields = buildWatchlistUpdateFields({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString(), checkedAt: now.toISOString(),
      reviewSummary: { percent: 92, count: 1500, desc: 'Very Positive' }
    })
    expect(fields.steamReviewPercent).toBe(92)
    expect(fields.steamReviewDesc).toBe('Very Positive')
    expect(fields.steamReviewCount).toBe(1500)
    expect(fields.reviewCheckedAt).toBe(now.toISOString())
  })

  it('omits Steam review fields entirely when no review summary is present (a still-Coming-Soon check, or a flip the server never got review data for)', () => {
    const fields = buildWatchlistUpdateFields({ flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString(), checkedAt: now.toISOString(), reviewSummary: null })
    expect(fields.steamReviewPercent).toBeUndefined()
    expect(fields.steamReviewDesc).toBeUndefined()
    expect(fields.steamReviewCount).toBeUndefined()
    expect(fields.reviewCheckedAt).toBeUndefined()
  })
})
