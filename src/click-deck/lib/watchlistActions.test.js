import { describe, it, expect } from 'vitest'
import { candidateToNewGame } from './watchlistActions'

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
