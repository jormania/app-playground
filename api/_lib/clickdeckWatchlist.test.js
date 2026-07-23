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
  const comingSoonGame = { releaseStatus: 'Coming Soon', tags: [] }
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

  test('still coming_soon: true — refreshes the display string/year/cover, does not flip', () => {
    const appData = { success: true, data: { release_date: { coming_soon: true, date: 'Q3 2026' }, header_image: 'https://example.com/dev.jpg' } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved).toEqual({ flipped: false, releaseDateString: 'Q3 2026', year: 2026, coverUrl: 'https://example.com/dev.jpg' })
  })

  test('coming_soon missing entirely (Steam gave no opinion) is treated the same as still-unreleased, never flips', () => {
    const appData = { success: true, data: { release_date: { date: 'TBA' } } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.flipped).toBe(false)
  })

  test('coming_soon: false is the sole flip signal — flips and stamps Released At exactly once', () => {
    const appData = { success: true, data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, header_image: 'https://example.com/final.jpg' } }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved).toEqual({
      flipped: true,
      releaseDateString: '15 Jul, 2026',
      year: 2026,
      releasedAt: now.toISOString(),
      coverUrl: 'https://example.com/final.jpg',
      derivedTags: null,
      derivedJournal: null,
      derivedDeveloper: null
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

  test('on flip, derives tags from Steam genres when the game has none yet', () => {
    const appData = {
      success: true,
      data: {
        release_date: { coming_soon: false, date: '15 Jul, 2026' },
        genres: [{ description: 'Adventure' }, { description: 'Indie' }, { description: '' }]
      }
    }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.derivedTags).toEqual(['Adventure', 'Indie'])
  })

  test('on flip, never overwrites tags the game already has', () => {
    const alreadyTagged = { releaseStatus: 'Coming Soon', tags: ['Point & Click'] }
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, genres: [{ description: 'Adventure' }] }
    }
    const resolved = resolveReleaseFlip(alreadyTagged, appData, now)
    expect(resolved.derivedTags).toBeNull()
  })

  test('on flip, caps derived tags at 7 even when Steam text matches many more keywords', () => {
    const appData = {
      success: true,
      data: {
        release_date: { coming_soon: false, date: '15 Jul, 2026' },
        genres: [{ description: 'Adventure' }, { description: 'Indie' }],
        short_description: 'A noir detective mystery thriller full of supernatural cyberpunk dystopian gothic horror.'
      }
    }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.derivedTags).toHaveLength(7)
  })

  test('on flip, derives journal from Steam short_description when the game has none yet', () => {
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, short_description: 'A time-travel adventure.' }
    }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.derivedJournal).toBe('A time-travel adventure.')
  })

  test('on flip, never overwrites a journal the game already has', () => {
    const alreadyNoted = { releaseStatus: 'Coming Soon', tags: [], journal: 'My own notes.' }
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, short_description: 'Marketing copy.' }
    }
    const resolved = resolveReleaseFlip(alreadyNoted, appData, now)
    expect(resolved.derivedJournal).toBeNull()
  })

  test('on flip, derives developer from Steam when the game has none yet', () => {
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, developers: ['Wadjet Eye Games'] }
    }
    const resolved = resolveReleaseFlip(comingSoonGame, appData, now)
    expect(resolved.derivedDeveloper).toBe('Wadjet Eye Games')
  })

  test('on flip, never overwrites a developer the game already has', () => {
    const alreadySet = { releaseStatus: 'Coming Soon', tags: [], developer: 'Existing Studio' }
    const appData = {
      success: true,
      data: { release_date: { coming_soon: false, date: '15 Jul, 2026' }, developers: ['Steam Studio'] }
    }
    const resolved = resolveReleaseFlip(alreadySet, appData, now)
    expect(resolved.derivedDeveloper).toBeNull()
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

  test('derived tags/journal/developer are written when present, omitted (not cleared) when null', () => {
    const withDerived = buildWatchlistPatchProperties({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: new Date().toISOString(),
      derivedTags: ['Adventure', 'Indie'], derivedJournal: 'A time-travel adventure.', derivedDeveloper: 'Wadjet Eye Games'
    })
    expect(withDerived['Tags']).toEqual({ multi_select: [{ name: 'Adventure' }, { name: 'Indie' }] })
    expect(withDerived['Journal/Notes']).toEqual({ rich_text: [{ text: { content: 'A time-travel adventure.' } }] })
    expect(withDerived['Developer/Studio']).toEqual({ select: { name: 'Wadjet Eye Games' } })

    const withoutDerived = buildWatchlistPatchProperties({
      flipped: true, releaseDateString: '15 Jul, 2026', year: 2026, releasedAt: new Date().toISOString(),
      derivedTags: null, derivedJournal: null, derivedDeveloper: null
    })
    expect(withoutDerived['Tags']).toBeUndefined()
    expect(withoutDerived['Journal/Notes']).toBeUndefined()
    expect(withoutDerived['Developer/Studio']).toBeUndefined()
  })
})
