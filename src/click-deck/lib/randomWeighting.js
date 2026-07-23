import { steamReviewScore } from './steamReviews'

// Midpoint of the 1-5 rating scale — the neutral score given to a candidate
// whose tags/studio have no rated history to draw an affinity from, so an
// unknown quantity lands squarely in the middle of the pack rather than being
// penalized (too low) or favored (too high) by default.
const NEUTRAL_AFFINITY = 3

// Below this many rated games, any affinity computed from them is really just
// noise — fall back to a uniform roll entirely rather than let two or three
// ratings pretend to know your taste. Exported so the [R] modal's badge text
// can tell "favoring your taste" from "still cold-starting" without
// duplicating the threshold.
export const COLD_START_MIN_RATED = 3

// ~2:1 — tag affinity carries roughly twice the weight of studio affinity in
// the blended taste score, per the locked R2 design decision.
const TAG_WEIGHT = 2
const STUDIO_WEIGHT = 1

// Average rating per tag, computed only from games that actually have both a
// rating and that tag. Exported so Settings/tests can inspect it directly.
export function computeTagAffinity(ratedGames) {
  const sums = {}
  ratedGames.forEach(g => {
    if (!g.rating) return
    ;(g.tags || []).forEach(tag => {
      if (!sums[tag]) sums[tag] = { sum: 0, count: 0 }
      sums[tag].sum += g.rating
      sums[tag].count += 1
    })
  })
  const affinity = {}
  Object.entries(sums).forEach(([tag, { sum, count }]) => { affinity[tag] = sum / count })
  return affinity
}

// Average rating per developer/studio, same shape as computeTagAffinity.
export function computeStudioAffinity(ratedGames) {
  const sums = {}
  ratedGames.forEach(g => {
    if (!g.rating || !g.developer) return
    if (!sums[g.developer]) sums[g.developer] = { sum: 0, count: 0 }
    sums[g.developer].sum += g.rating
    sums[g.developer].count += 1
  })
  const affinity = {}
  Object.entries(sums).forEach(([dev, { sum, count }]) => { affinity[dev] = sum / count })
  return affinity
}

// A candidate's blended taste score: the average tag affinity across its own
// tags, blended ~2:1 with its studio affinity, falling back to the neutral
// midpoint wherever there's no rated history to draw from (a candidate with
// zero known tags/studio still gets a plain neutral score, same as uniform).
function tasteScore(game, tagAffinity, studioAffinity) {
  const tagScores = (game.tags || []).map(t => tagAffinity[t]).filter(v => v !== undefined)
  const tagScore = tagScores.length > 0 ? tagScores.reduce((a, b) => a + b, 0) / tagScores.length : NEUTRAL_AFFINITY
  const studioScore = game.developer && studioAffinity[game.developer] !== undefined ? studioAffinity[game.developer] : NEUTRAL_AFFINITY
  return (TAG_WEIGHT * tagScore + STUDIO_WEIGHT * studioScore) / (TAG_WEIGHT + STUDIO_WEIGHT)
}

// Weighted selection for the Random Game roll. Rank-based: sort the candidates by
// the favored dimension, then give the most-favored entry a weight of N (the pool
// size), decreasing to 1 for the least-favored — so bias scales gracefully with
// however many backlog games there are, without needing a fixed weight constant.
// `context.ratedGames` is only read by 'taste' mode — the rated history to build
// tag/studio affinity from, which is necessarily a different (usually larger,
// mostly-Completed) pool than `games` itself (the Backlog candidates being ranked).
export function computeWeights(games, mode, context = {}) {
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
  if (mode === 'acclaimed') {
    // Confidence-adjusted (Wilson lower bound), not raw percentage — see
    // steamReviews.js's steamReviewScore comment for why. A candidate with
    // no Steam review data ranks least-favored, same "missing is worst, not
    // excluded" rule as 'cheapest' above. When NO candidate has review data
    // at all (e.g. right after shipping, before the first nightly cron
    // pass), every score ties at the same fallback value, and the stable
    // sort just preserves array order — an arbitrary positional bias, not
    // a meaningful ranking (same latent characteristic 'cheapest'/'oldest'
    // already have for exact ties, not something new here). RandomGameModal's
    // badge flags this state explicitly rather than implying real signal.
    const rankedIds = [...games]
      .sort((a, b) => (steamReviewScore(b) ?? -1) - (steamReviewScore(a) ?? -1))
      .map(g => g.id)
    return games.map(g => n - rankedIds.indexOf(g.id))
  }
  if (mode === 'taste') {
    const ratedGames = (context.ratedGames || []).filter(g => g.rating)
    if (ratedGames.length < COLD_START_MIN_RATED) return games.map(() => 1)
    const tagAffinity = computeTagAffinity(ratedGames)
    const studioAffinity = computeStudioAffinity(ratedGames)
    // Descending — the highest taste score lands at index 0, which is what
    // the shared "n - rank" formula below treats as most-favored.
    const rankedIds = [...games]
      .sort((a, b) => tasteScore(b, tagAffinity, studioAffinity) - tasteScore(a, tagAffinity, studioAffinity))
      .map(g => g.id)
    return games.map(g => n - rankedIds.indexOf(g.id))
  }
  return games.map(() => 1)
}

// randomFn is injectable so tests can drive selection deterministically instead
// of relying on Math.random.
export function pickWeightedGame(games, mode = 'uniform', randomFn = Math.random, context = {}) {
  if (!games || games.length === 0) return null
  const weights = computeWeights(games, mode, context)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = randomFn() * total
  for (let i = 0; i < games.length; i++) {
    r -= weights[i]
    if (r < 0) return games[i]
  }
  return games[games.length - 1]
}

export const RANDOM_WEIGHT_MODES = ['uniform', 'oldest', 'cheapest', 'taste', 'acclaimed']
