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
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '15 Jul, 2026' } } }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now)
    // The client twin also carries checkedAt (the server copy doesn't need it —
    // the cron already stamps Price Updated At through the pricing resolver;
    // the manual "Refresh Release Dates" path has no pricing pass, so it uses
    // checkedAt to keep [W]'s "last checked" staleness age honest).
    expect(resolved).toEqual({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026,
      releasedAt: now.toISOString(), checkedAt: now.toISOString()
    })
  })

  it('a non-flip check still records checkedAt so the "last checked" age advances even when nothing launched', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'Q3 2026' } } }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now)
    expect(resolved).toEqual({ flipped: false, releaseDateString: 'Q3 2026', year: 2026, checkedAt: now.toISOString() })
  })

  it('normalizes Steam\'s "To be announced" to "TBA"', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'To be announced' } } }
    expect(resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now).releaseDateString).toBe('TBA')
  })

  it('buildWatchlistUpdateFields produces game-object fields (including priceUpdatedAt from checkedAt), not raw Notion properties', () => {
    const fields = buildWatchlistUpdateFields({ flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString(), checkedAt: now.toISOString() })
    expect(fields).toEqual({ releaseDate: '15 Jul, 2026', priceUpdatedAt: now.toISOString(), year: 2026, releaseStatus: 'Released', releasedAt: now.toISOString() })
  })

  it('a non-flip refresh updates the display fields + last-checked stamp, leaving releaseStatus/releasedAt untouched', () => {
    const fields = buildWatchlistUpdateFields({ flipped: false, releaseDateString: 'Q3 2026', year: 2026, checkedAt: now.toISOString() })
    expect(fields).toEqual({ releaseDate: 'Q3 2026', priceUpdatedAt: now.toISOString(), year: 2026 })
    expect(fields.releaseStatus).toBeUndefined()
    expect(fields.releasedAt).toBeUndefined()
  })
})
