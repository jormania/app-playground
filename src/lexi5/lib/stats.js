import { readJson, writeJson } from '../../shared/storage'
import { daysSinceEpoch } from './dateKey'

/** The per-dictionary statistics schema, its migrations, and the Crown-win history. */

const STATS_KEY = 'lexi5_stats'
const HISTORY_KEY = 'lexi5_history'

const DEFAULT_STATS_DICT = {
  gamesPlayed: 0,
  gamesWon: 0,
  crownGamesPlayed: 0,
  crownGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  crownCurrentStreak: 0,
  crownMaxStreak: 0,
  guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
}

// A factory, not a shared constant. `{ ...DEFAULT_STATS_DICT }` is a shallow copy, so
// the old object literal handed all five dictionaries the *same* nested `guesses` object
// — safe only for as long as every update spreads before writing, and one direct mutation
// away from corrupting every dictionary's histogram at once.
const makeDictStats = () => ({ ...DEFAULT_STATS_DICT, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } })

const makeDefaultStats = () => ({
  lite: makeDictStats(),
  standard: makeDictStats(),
  expanded: makeDictStats(),
  expert: makeDictStats(),
  custom: makeDictStats()
})

// Built-in dictionaries, ordered easiest to hardest (Custom is user-curated, so it's

const HISTORY_RETENTION_DAYS = 30

function pruneHistory(history) {
  const cutoff = daysSinceEpoch(new Date().toDateString()) - HISTORY_RETENTION_DAYS
  const kept = {}
  for (const [key, value] of Object.entries(history)) {
    const dateString = key.slice(key.indexOf(':') + 1)
    const day = daysSinceEpoch(dateString)
    // Keep anything we can't parse a date out of rather than silently dropping it.
    if (Number.isNaN(day) || day >= cutoff) kept[key] = value
  }
  return kept
}

function loadStats() {
  try {
    const stored = readJson(STATS_KEY, null)
    if (stored) {
      // Migration from non-dictionary stats
      if (stored.gamesPlayed !== undefined) {
        return {
          ...makeDefaultStats(),
          standard: { ...makeDictStats(), ...stored }
        }
      }
      return {
        ...makeDefaultStats(),
        lite: { ...makeDictStats(), ...(stored.lite || {}) },
        standard: { ...makeDictStats(), ...(stored.standard || {}) },
        expanded: { ...makeDictStats(), ...(stored.expanded || {}) },
        expert: { ...makeDictStats(), ...(stored.expert || {}) },
        custom: { ...makeDictStats(), ...(stored.custom || {}) },
      }
    }
    return makeDefaultStats()
  } catch {
    return makeDefaultStats()
  }
}

// Folds a loss for a game abandoned mid-play (left unfinished past midnight) into a
// stats object, using the same shape updateStats writes, so it surfaces in Stats (pure).
function applyAbandonedLoss(statsObj, dict, wasCrown) {
  const prevDict = dict || 'standard'
  const dictStats = { ...makeDictStats(), ...(statsObj[prevDict] || {}) }
  return {
    ...statsObj,
    [prevDict]: {
      ...dictStats,
      gamesPlayed: dictStats.gamesPlayed + 1,
      crownGamesPlayed: dictStats.crownGamesPlayed + (wasCrown ? 1 : 0),
      currentStreak: 0,
      crownCurrentStreak: wasCrown ? 0 : dictStats.crownCurrentStreak
    }
  }
}

// Computes the initial game state (pure — no writes) plus, if a prior game was left

export function readHistory() {
  return readJson(HISTORY_KEY, {})
}

export function recordCrownWin(dict, dateString) {
  const history = readHistory()
  history[`${dict}:${dateString}`] = true
  writeJson(HISTORY_KEY, pruneHistory(history))
}

export function wasGameWon(dictionary, dateString) {
  const history = readJson(HISTORY_KEY, {})
  return !!history[`${dictionary}:${dateString}`]
}

export { STATS_KEY, HISTORY_KEY, makeDictStats, makeDefaultStats, loadStats, applyAbandonedLoss, pruneHistory }
