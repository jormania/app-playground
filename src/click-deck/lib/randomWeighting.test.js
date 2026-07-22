import { describe, it, expect } from 'vitest'
import { computeWeights, pickWeightedGame, computeTagAffinity, computeStudioAffinity } from './randomWeighting'

const games = [
  { id: 'a', createdTime: '2024-01-03T00:00:00.000Z', price: 20 }, // newest, mid price
  { id: 'b', createdTime: '2024-01-01T00:00:00.000Z', price: 30 }, // oldest, most expensive
  { id: 'c', createdTime: '2024-01-02T00:00:00.000Z', price: 10 }  // middle, cheapest
]

describe('computeWeights', () => {
  it('gives every game equal weight in uniform mode', () => {
    expect(computeWeights(games, 'uniform')).toEqual([1, 1, 1])
  })

  it('weights the oldest createdTime highest in "oldest" mode', () => {
    // b is oldest (rank 0 -> weight 3), c is middle (rank 1 -> weight 2), a is newest (rank 2 -> weight 1)
    expect(computeWeights(games, 'oldest')).toEqual([1, 3, 2])
  })

  it('weights the cheapest price highest in "cheapest" mode', () => {
    // c is cheapest (weight 3), a is mid (weight 2), b is priciest (weight 1)
    expect(computeWeights(games, 'cheapest')).toEqual([2, 1, 3])
  })

  it('treats a missing price as the most expensive (least favored) in "cheapest" mode', () => {
    const withUnpriced = [...games, { id: 'd', createdTime: '2024-01-04T00:00:00.000Z', price: null }]
    const weights = computeWeights(withUnpriced, 'cheapest')
    expect(weights[3]).toBe(1) // 'd' ranks last
  })
})

describe('computeTagAffinity', () => {
  it('averages rating per tag, ignoring unrated games', () => {
    const rated = [
      { rating: 5, tags: ['Noir', 'Mystery'] },
      { rating: 3, tags: ['Noir'] },
      { rating: null, tags: ['Noir'] } // unrated — excluded
    ]
    const affinity = computeTagAffinity(rated)
    expect(affinity['Noir']).toBe(4) // (5+3)/2
    expect(affinity['Mystery']).toBe(5)
  })
})

describe('computeStudioAffinity', () => {
  it('averages rating per developer, ignoring unrated/developer-less games', () => {
    const rated = [
      { rating: 4, developer: 'LucasArts' },
      { rating: 2, developer: 'LucasArts' },
      { rating: 5, developer: '' } // no developer — excluded
    ]
    const affinity = computeStudioAffinity(rated)
    expect(affinity['LucasArts']).toBe(3) // (4+2)/2
    expect(affinity['']).toBeUndefined()
  })
})

describe('computeWeights (taste mode)', () => {
  const tasteCandidates = [
    { id: 'noir-game', tags: ['Noir'], developer: 'Unrated Studio' },
    { id: 'comedy-game', tags: ['Comedy'], developer: 'Unrated Studio' }
  ]

  it('falls back to uniform weights when fewer than 3 rated games exist (cold start)', () => {
    const ratedGames = [
      { rating: 5, tags: ['Noir'], developer: 'X' },
      { rating: 4, tags: ['Noir'], developer: 'X' }
    ]
    expect(computeWeights(tasteCandidates, 'taste', { ratedGames })).toEqual([1, 1])
  })

  it('favors a candidate whose tags match a highly-rated tag history', () => {
    const ratedGames = [
      { rating: 5, tags: ['Noir'], developer: 'A' },
      { rating: 5, tags: ['Noir'], developer: 'B' },
      { rating: 1, tags: ['Comedy'], developer: 'C' }
    ]
    const weights = computeWeights(tasteCandidates, 'taste', { ratedGames })
    const noirWeight = weights[tasteCandidates.findIndex(g => g.id === 'noir-game')]
    const comedyWeight = weights[tasteCandidates.findIndex(g => g.id === 'comedy-game')]
    expect(noirWeight).toBeGreaterThan(comedyWeight)
  })

  it('treats a missing ratedGames context the same as cold-start (uniform)', () => {
    expect(computeWeights(tasteCandidates, 'taste')).toEqual([1, 1])
  })
})

describe('pickWeightedGame', () => {
  it('returns null for an empty pool', () => {
    expect(pickWeightedGame([], 'uniform')).toBeNull()
  })

  it('picks deterministically according to the injected random function', () => {
    // uniform weights [1,1,1], total 3. randomFn() * 3 = 0 -> first game.
    expect(pickWeightedGame(games, 'uniform', () => 0)).toBe(games[0])
    // randomFn() * 3 just under 3 -> last game.
    expect(pickWeightedGame(games, 'uniform', () => 0.999)).toBe(games[2])
  })

  it('biases selection toward the favored game across many draws', () => {
    let oldestPicks = 0
    const trials = 500
    for (let i = 0; i < trials; i++) {
      const picked = pickWeightedGame(games, 'oldest', Math.random)
      if (picked.id === 'b') oldestPicks++
    }
    // 'b' has weight 3 of a total of 6 (1+3+2) -> ~50% expected; assert it's
    // clearly favored over a uniform 1/3 baseline without being flaky.
    expect(oldestPicks / trials).toBeGreaterThan(0.35)
  })
})
