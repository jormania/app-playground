import { readJson, writeJson } from '../../shared/storage'
import { daysSinceEpoch } from './dateKey'

/** The per-dictionary statistics schema, its migrations, and the Crown-win history. */

const STATS_KEY = 'lexi5_stats'
const HISTORY_KEY = 'lexi5_history'

export type DictionaryKey = 'lite' | 'standard' | 'expanded' | 'expert' | 'custom'

/** Per-dictionary counters. "Crown" is the first game of a calendar day. */
export interface DictStats {
  gamesPlayed: number
  gamesWon: number
  crownGamesPlayed: number
  crownGamesWon: number
  currentStreak: number
  maxStreak: number
  crownCurrentStreak: number
  crownMaxStreak: number
  /** Wins bucketed by how many guesses they took, 1-6. */
  guesses: Record<number, number>
}

export type Stats = Record<DictionaryKey, DictStats>

/** `dictionary:dateString` -> true for wins, or the word served for `lexi5_served`. */
type HistoryMap = Record<string, unknown>

const DEFAULT_STATS_DICT: DictStats = {
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
const makeDictStats = (): DictStats => ({ ...DEFAULT_STATS_DICT, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } })

const makeDefaultStats = (): Stats => ({
  lite: makeDictStats(),
  standard: makeDictStats(),
  expanded: makeDictStats(),
  expert: makeDictStats(),
  custom: makeDictStats()
})

// Built-in dictionaries, ordered easiest to hardest (Custom is user-curated, so it's

const HISTORY_RETENTION_DAYS = 30

function pruneHistory(history: HistoryMap): HistoryMap {
  const cutoff = daysSinceEpoch(new Date().toDateString()) - HISTORY_RETENTION_DAYS
  const kept: HistoryMap = {}
  for (const [key, value] of Object.entries(history)) {
    const dateString = key.slice(key.indexOf(':') + 1)
    const day = daysSinceEpoch(dateString)
    // Keep anything we can't parse a date out of rather than silently dropping it.
    if (Number.isNaN(day) || day >= cutoff) kept[key] = value
  }
  return kept
}

function loadStats(): Stats {
  try {
    const stored = readJson<any>(STATS_KEY, null)
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
function applyAbandonedLoss(statsObj: Stats, dict: DictionaryKey, wasCrown: boolean): Stats {
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

export function readHistory(): HistoryMap {
  return readJson<HistoryMap>(HISTORY_KEY, {})
}

export function recordCrownWin(dict: DictionaryKey, dateString: string): void {
  const history = readHistory()
  history[`${dict}:${dateString}`] = true
  writeJson(HISTORY_KEY, pruneHistory(history))
}

const SERVED_KEY = 'lexi5_served'

/**
 * Records which word a dictionary actually served on a given day.
 *
 * The Archive used to recompute past days from the *current* word list, which is right
 * for the built-in dictionaries (they never change) and wrong for Custom: re-curating
 * replaces the list, so the Archive confidently displayed words that were never that
 * day's answer. Only Custom needs this — for the built-ins the derivation is stable and
 * storing 13,106 words' worth of history would be pure waste.
 */
export function recordServedWord(dict: DictionaryKey, dateString: string, word: string): void {
  if (dict !== 'custom') return
  const served = readJson<HistoryMap>(SERVED_KEY, {})
  const key = `${dict}:${dateString}`
  if (served[key] === word) return
  served[key] = word
  writeJson(SERVED_KEY, pruneHistory(served))
}

/** The word actually served, or null if that day predates this record. */
export function getServedWord(dict: DictionaryKey, dateString: string): string | null {
  if (dict !== 'custom') return null
  const served = readJson<HistoryMap>(SERVED_KEY, {})
  return (served[`${dict}:${dateString}`] as string | undefined) ?? null
}

export function wasGameWon(dictionary: DictionaryKey, dateString: string): boolean {
  const history = readHistory()
  return !!history[`${dictionary}:${dateString}`]
}

export { STATS_KEY, HISTORY_KEY, makeDictStats, makeDefaultStats, loadStats, applyAbandonedLoss, pruneHistory }
