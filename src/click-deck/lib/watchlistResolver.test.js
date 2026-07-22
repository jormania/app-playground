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

  it('flips and stamps Released At exactly once when coming_soon becomes false', () => {
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '15 Jul, 2026' } } }
    const resolved = resolveReleaseFlip({ releaseStatus: 'Coming Soon' }, appData, now)
    expect(resolved).toEqual({ flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString() })
  })

  it('buildWatchlistUpdateFields produces game-object fields, not raw Notion properties', () => {
    const fields = buildWatchlistUpdateFields({ flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString() })
    expect(fields).toEqual({ releaseDate: '15 Jul, 2026', year: 2026, releaseStatus: 'Released', releasedAt: now.toISOString() })
  })

  it('a non-flip refresh only updates the display fields, leaving releaseStatus/releasedAt untouched', () => {
    const fields = buildWatchlistUpdateFields({ flipped: false, releaseDateString: 'Q3 2026', year: 2026 })
    expect(fields).toEqual({ releaseDate: 'Q3 2026', year: 2026 })
    expect(fields.releaseStatus).toBeUndefined()
    expect(fields.releasedAt).toBeUndefined()
  })
})
