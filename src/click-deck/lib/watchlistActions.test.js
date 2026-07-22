/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { candidateToNewGame, candidateToIgnoredGame, unignoreGame, getIgnoredGames } from './watchlistActions'

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
