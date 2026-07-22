import { test, expect, describe } from 'vitest'
import { parseYearFromReleaseDateString, resolveReleaseFlip, buildWatchlistPatchProperties } from './clickdeckWatchlist.js'

describe('parseYearFromReleaseDateString', () => {
  test('extracts a 4-digit year from a precise Steam date', () => {
    expect(parseYearFromReleaseDateString('15 Jul, 2026')).toBe(2026)
  })
  test('extracts a year from a quarter-only Steam date', () => {
    expect(parseYearFromReleaseDateString('Q3 2026')).toBe(2026)
  })
  test('returns null when there is no year to find', () => {
    expect(parseYearFromReleaseDateString('Coming soon')).toBeNull()
    expect(parseYearFromReleaseDateString('')).toBeNull()
    expect(parseYearFromReleaseDateString(null)).toBeNull()
    expect(parseYearFromReleaseDateString(undefined)).toBeNull()
  })
})

describe('resolveReleaseFlip', () => {
  const comingSoonGame = { releaseStatus: 'Coming Soon' }
  const now = new Date('2026-07-22T02:00:00.000Z')

  test('ignores games that are not tracked as Coming Soon (blocking finding #1: never backfills Released At on a direct add)', () => {
    const releasedGame = { releaseStatus: 'Released' }
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '1 Jan, 2019' } } }
    expect(resolveReleaseFlip(releasedGame, appData, now)).toBeNull()
    expect(resolveReleaseFlip({ releaseStatus: undefined }, appData, now)).toBeNull()
  })

  test('returns null for malformed/failed Steam data', () => {
    expect(resolveReleaseFlip(comingSoonGame, undefined, now)).toBeNull()
    expect(resolveReleaseFlip(comingSoonGame, [], now)).toBeNull()
    expect(resolveReleaseFlip(comingSoonGame, { success: false }, now)).toBeNull()
    expect(resolveReleaseFlip(comingSoonGame, { success: true, data: [] }, now)).toBeNull()
  })

  test('still coming_soon: true — refreshes the display string/year, does not flip', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'Q3 2026' } } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved).toEqual({ flipped: false, releaseDateString: 'Q3 2026', year: 2026 })
  })

  test('coming_soon missing entirely (Steam gave no opinion) is treated the same as still-unreleased, never flips', () => {
    const appData = { success: true, data: { release_date: { date: 'TBA' } } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.flipped).toBe(false)
  })

  test('coming_soon: false is the sole flip signal — flips and stamps Released At exactly once', () => {
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '15 Jul, 2026' } } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved).toEqual({
      flipped: true,
      releaseDateString: '15 Jul, 2026',
      year: 2026,
      releasedAt: now.toISOString()
    })
  })

  test('a priced pre-order (price present) still coming_soon: true never flips on price alone', () => {
    const appData = {
      success: true,
      data: {
        release_date: { coming_soon: true, date: '1 Sep, 2026' },
        price_overview: { final: 1999, initial: 1999, discount_percent: 0 }
      }
    }
    expect(resolveReleaseFlip(comingSoonGame, appData, now).flipped).toBe(false)
  })
})

describe('buildWatchlistPatchProperties', () => {
  test('a non-flip refresh updates Release Date/Year only, never touches Release Status or Released At', () => {
    const props = buildWatchlistPatchProperties({ flipped: false, releaseDateString: 'Q3 2026', year: 2026 })
    expect(props['Release Date']).toEqual({ rich_text: [{ text: { content: 'Q3 2026' } }] })
    expect(props['Release Year']).toEqual({ number: 2026 })
    expect(props['Release Status']).toBeUndefined()
    expect(props['Released At']).toBeUndefined()
  })

  test('a flip sets Release Status and stamps Released At exactly once', () => {
    const now = new Date('2026-07-22T02:00:00.000Z')
    const props = buildWatchlistPatchProperties({ flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: now.toISOString() })
    expect(props['Release Status']).toEqual({ select: { name: 'Released' } })
    expect(props['Released At']).toEqual({ date: { start: now.toISOString() } })
  })

  test('no year recoverable omits the Release Year write rather than clobbering it with null', () => {
    const props = buildWatchlistPatchProperties({ flipped: false, releaseDateString: 'Coming soon', year: null })
    expect(props['Release Year']).toBeUndefined()
  })
})
