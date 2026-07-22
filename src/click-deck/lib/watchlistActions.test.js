/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { candidateToNewGame, candidateToIgnoredGame, unignoreGame, getIgnoredGames, searchFollowedStudios } from './watchlistActions'

describe('candidateToNewGame', () => {
  const releasedCandidate = {
    appId: 123, title: 'Old Skies', developer: 'Wadjet Eye Games', matchedStudio: 'Wadjet Eye Games',
    comingSoon: false, releaseDateString: '23 May, 2025', year: 2025, price: 19.99,
    headerImage: 'https://example.com/123.jpg', shortDescription: 'A time-travel adventure.',
    tags: ['Adventure', 'Point & Click', 'Story Rich', 'Sci-Fi', 'Time Travel', 'Mystery', 'Detective', 'Pixel Graphics']
  }
  const comingSoonCandidate = {
    appId: 456, title: 'Gilt', developer: 'Wadjet Eye Games', matchedStudio: 'Wadjet Eye Games',
    comingSoon: true, releaseDateString: '2026', year: 2026, price: null,
    headerImage: 'https://example.com/456.jpg', shortDescription: 'An upcoming boxing adventure.',
    tags: ['Adventure', 'Indie']
  }

  it('an already-released candidate is enriched: Steam tags (capped at 7), a description, price, cover', () => {
    const g = candidateToNewGame(releasedCandidate)
    expect(g.releaseStatus).toBe('Released')
    expect(g.releasedAt).toBeNull() // never stamped on a direct add (blocking finding #1)
    expect(g.tags).toHaveLength(7) // sliced from 8 down to the 7-tag cap
    expect(g.journal).toBe('A time-travel adventure.')
    expect(g.coverUrl).toBe('https://example.com/123.jpg')
    expect(g.price).toBe(19.99)
    expect(g.status).toBe('Backlog')
  })

  it('a Coming Soon candidate lands intentionally bare: no tags, no journal — so the 5-7 policy and the post-release nudge stay honest', () => {
    const g = candidateToNewGame(comingSoonCandidate)
    expect(g.releaseStatus).toBe('Coming Soon')
    expect(g.releasedAt).toBeNull()
    expect(g.tags).toEqual([])
    expect(g.journal).toBe('')
    // Metadata that isn't tags/journal still comes through.
    expect(g.releaseDate).toBe('2026')
    expect(g.year).toBe(2026)
    expect(g.coverUrl).toBe('https://example.com/456.jpg')
  })

  it('falls back gracefully when a candidate is missing optional fields', () => {
    const g = candidateToNewGame({ appId: 789, title: 'Bare', comingSoon: false })
    expect(g.tags).toEqual([])
    expect(g.journal).toBe('')
    expect(g.coverUrl).toBe('')
    expect(g.developer).toBe('')
  })
})

describe('candidateToIgnoredGame', () => {
  it('lands as Ignored with no tags/journal/price — nothing an ignored game needs', () => {
    const g = candidateToIgnoredGame({
      appId: 999, title: 'Not Interested', matchedStudio: 'Some Studio',
      releaseDateString: '2027', headerImage: 'https://example.com/999.jpg', price: 29.99
    })
    expect(g.releaseStatus).toBe('Ignored')
    expect(g.releasedAt).toBeNull()
    expect(g.tags).toEqual([])
    expect(g.journal).toBe('')
    expect(g.price).toBeNull()
    expect(g.coverUrl).toBe('https://example.com/999.jpg') // still keeps enough to display in the Ignored list
    expect(g.appId).toBe(999)
  })
})

describe('getIgnoredGames', () => {
  it('returns only Ignored games', () => {
    const games = [
      { id: '1', releaseStatus: 'Ignored' },
      { id: '2', releaseStatus: 'Coming Soon' },
      { id: '3', releaseStatus: 'Released' },
      { id: '4' } // legacy, defaults to Released
    ]
    expect(getIgnoredGames(games).map(g => g.id)).toEqual(['1'])
  })
})

describe('searchFollowedStudios — curated (tier-first) ordering', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockCandidates(candidates) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates })
    }))
  }

  it('ranks a higher-tier studio above a lower-tier one regardless of release timing', async () => {
    mockCandidates([
      { appId: 1, title: 'Soon (Tier 1)', matchedStudio: 'Opportunistic Co', studioTier: 1, comingSoon: true, year: 2026, releaseDateString: '2026' },
      { appId: 2, title: 'Later (Tier 3)', matchedStudio: 'Automatic Follow Inc', studioTier: 3, comingSoon: true, year: 2027, releaseDateString: '2027' }
    ])
    const result = await searchFollowedStudios([{ name: 'Opportunistic Co' }, { name: 'Automatic Follow Inc' }], [])
    expect(result.notYetReleased.map(c => c.title)).toEqual(['Later (Tier 3)', 'Soon (Tier 1)'])
  })

  it('within the same tier, sorts not-yet-released soonest-first', async () => {
    mockCandidates([
      { appId: 1, title: 'Far Off', matchedStudio: 'Studio', studioTier: 2, comingSoon: true, year: 2028, releaseDateString: '2028' },
      { appId: 2, title: 'Coming Sooner', matchedStudio: 'Studio', studioTier: 2, comingSoon: true, year: 2026, releaseDateString: '2026' }
    ])
    const result = await searchFollowedStudios([{ name: 'Studio' }], [])
    expect(result.notYetReleased.map(c => c.title)).toEqual(['Coming Sooner', 'Far Off'])
  })

  it('within the same tier, sorts already-released most-recent-first', async () => {
    mockCandidates([
      { appId: 1, title: 'Old Release', matchedStudio: 'Studio', studioTier: 2, comingSoon: false, year: 2019, releaseDateString: '2019' },
      { appId: 2, title: 'Recent Release', matchedStudio: 'Studio', studioTier: 2, comingSoon: false, year: 2025, releaseDateString: '2025' }
    ])
    const result = await searchFollowedStudios([{ name: 'Studio' }], [])
    expect(result.alreadyReleased.map(c => c.title)).toEqual(['Recent Release', 'Old Release'])
  })

  it('an untiered studio (no valueTier set) ranks below any explicitly tiered studio', async () => {
    mockCandidates([
      { appId: 1, title: 'Untiered', matchedStudio: 'Legacy Studio', studioTier: null, comingSoon: true, year: 2026, releaseDateString: '2026' },
      { appId: 2, title: 'Tier 1', matchedStudio: 'New Studio', studioTier: 1, comingSoon: true, year: 2026, releaseDateString: '2026' }
    ])
    const result = await searchFollowedStudios([{ name: 'Legacy Studio' }, { name: 'New Studio' }], [])
    expect(result.notYetReleased.map(c => c.title)).toEqual(['Tier 1', 'Untiered'])
  })
})

describe('unignoreGame', () => {
  afterEach(() => vi.unstubAllGlobals())

  const ignoredGame = { id: 'g1', title: 'Old Skies', appId: 123, releaseStatus: 'Ignored', releasedAt: null, coverUrl: '', year: null }

  it('rejects a game with no Steam App ID rather than silently no-opping', async () => {
    await expect(unignoreGame({ id: 'g1', title: 'No App ID' })).rejects.toThrow('no Steam App ID')
  })

  it('restores to Released (never stamping Released At) when Steam now shows it launched, refreshing price/cover', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '123': {
          success: true,
          data: {
            release_date: { coming_soon: false, date: '1 Jun, 2026' },
            header_image: 'https://example.com/fresh.jpg',
            price_overview: { final: 1999, initial: 2499, discount_percent: 20 }
          }
        }
      })
    }))
    const result = await unignoreGame(ignoredGame)
    expect(result.releaseStatus).toBe('Released')
    expect(result.releasedAt).toBeNull() // a status correction, not an observed transition
    expect(result.price).toBe(19.99)
    expect(result.initialPrice).toBe(24.99)
    expect(result.discountPercent).toBe(0.2)
    expect(result.coverUrl).toBe('https://example.com/fresh.jpg')
    expect(result.releaseDate).toBe('1 Jun, 2026')
  })

  it('restores to Released and derives tags/journal/developer from Steam, same as an observed flip, when the game has none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '123': {
          success: true,
          data: {
            release_date: { coming_soon: false, date: '1 Jun, 2026' },
            genres: [{ description: 'Adventure' }, { description: 'Indie' }],
            short_description: 'A time-travel adventure.',
            developers: ['Wadjet Eye Games']
          }
        }
      })
    }))
    const result = await unignoreGame(ignoredGame)
    expect(result.tags).toEqual(['Adventure', 'Indie'])
    expect(result.journal).toBe('A time-travel adventure.')
    expect(result.developer).toBe('Wadjet Eye Games')
  })

  it('never overwrites tags/journal/developer the game already has when un-ignoring', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '123': {
          success: true,
          data: {
            release_date: { coming_soon: false, date: '1 Jun, 2026' },
            genres: [{ description: 'Adventure' }],
            short_description: 'Marketing copy.',
            developers: ['Steam Studio']
          }
        }
      })
    }))
    const alreadyFilled = { ...ignoredGame, tags: ['Point & Click'], journal: 'My own notes.', developer: 'Existing Studio' }
    const result = await unignoreGame(alreadyFilled)
    expect(result.tags).toEqual(['Point & Click'])
    expect(result.journal).toBe('My own notes.')
    expect(result.developer).toBe('Existing Studio')
  })

  it('restores to Coming Soon when Steam still shows it unreleased', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '123': { success: true, data: { release_date: { coming_soon: true, date: 'Q4 2026' } } } })
    }))
    const result = await unignoreGame(ignoredGame)
    expect(result.releaseStatus).toBe('Coming Soon')
    expect(result.releasedAt).toBeNull()
    expect(result.year).toBe(2026)
  })

  it('throws when Steam has no data for the App ID anymore (delisted)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ '123': { success: false } }) }))
    await expect(unignoreGame(ignoredGame)).rejects.toThrow('no current data')
  })
})
