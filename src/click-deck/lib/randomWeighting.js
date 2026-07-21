// Weighted selection for the Random Game roll. Rank-based: sort the candidates by
// the favored dimension, then give the most-favored entry a weight of N (the pool
// size), decreasing to 1 for the least-favored — so bias scales gracefully with
// however many backlog games there are, without needing a fixed weight constant.
export function computeWeights(games, mode) {
  const n = games.length
  if (mode === 'oldest') {
    const rankedIds = [...games]
      .sort((a, b) => new Date(a.createdTime || 0) - new Date(b.createdTime || 0))
      .map(g => g.id)
    return games.map(g => n - rankedIds.indexOf(g.id))
  }
  if (mode === 'cheapest') {
    // Games with no known price are treated as most expensive (least favored),
    // rather than excluded, so they can still come up.
    const rankedIds = [...games]
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      .map(g => g.id)
    return games.map(g => n - rankedIds.indexOf(g.id))
  }
  return games.map(() => 1)
}

// randomFn is injectable so tests can drive selection deterministically instead
// of relying on Math.random.
export function pickWeightedGame(games, mode = 'uniform', randomFn = Math.random) {
  if (!games || games.length === 0) return null
  const weights = computeWeights(games, mode)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = randomFn() * total
  for (let i = 0; i < games.length; i++) {
    r -= weights[i]
    if (r < 0) return games[i]
  }
  return games[games.length - 1]
}

export const RANDOM_WEIGHT_MODES = ['uniform', 'oldest', 'cheapest']
