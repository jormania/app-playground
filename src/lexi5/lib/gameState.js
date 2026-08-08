import { useState, useEffect } from 'react'
import wordsData from '../data/words.json'

const STATS_KEY = 'lexi5_stats'
const GAME_KEY = 'lexi5_game'

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

const DEFAULT_STATS = {
  lite: { ...DEFAULT_STATS_DICT },
  standard: { ...DEFAULT_STATS_DICT },
  expanded: { ...DEFAULT_STATS_DICT },
  expert: { ...DEFAULT_STATS_DICT },
  custom: { ...DEFAULT_STATS_DICT }
}

// Built-in dictionaries, ordered easiest to hardest (Custom is user-curated, so it's
// surfaced separately rather than slotted into this difficulty ordering).
export const BUILTIN_DICTIONARY_ORDER = ['lite', 'standard', 'expanded', 'expert']

export const DICTIONARY_SIZES = BUILTIN_DICTIONARY_ORDER.reduce((acc, key) => {
  acc[key] = wordsData.dictionaries[key].length
  return acc
}, {})

export const DICTIONARY_LABELS = {
  lite: 'Lite',
  standard: 'Standard',
  expanded: 'Expanded',
  expert: 'Expert',
  custom: 'Custom (AI Curated)'
}

export function hasCustomDictionary() {
  try {
    const customList = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
    return !!(customList && customList.length > 0)
  } catch (_e) {
    return false
  }
}

export function getCustomDictionarySize() {
  try {
    const customList = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
    return customList ? customList.length : 0
  } catch (_e) {
    return 0
  }
}

// A dictionary of 'custom' with no curated list yet isn't playable — fall back to
// Standard rather than silently serving Standard words under the 'custom' label.
export function normalizeDictionary(dictionary) {
  if (dictionary === 'custom' && !hasCustomDictionary()) return 'standard'
  return dictionary
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return hash >>> 0
}

// Deterministic PRNG (mulberry32) so a shuffle is reproducible from a numeric seed
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleCache = new Map()

// A deterministic shuffled permutation of a list's indices, reseeded automatically
// whenever the list's contents change OR when the list completes a full cycle.
function getShuffledOrder(list, cycleNumber = 0) {
  const key = `${list.length}:${hashString(list.join(','))}:cycle:${cycleNumber}`
  const cached = shuffleCache.get(key)
  if (cached) return cached

  const rand = mulberry32(hashString(key))
  const order = list.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  shuffleCache.set(key, order)
  return order
}

function resolveDictionaryList(dictionary) {
  if (dictionary === 'custom') {
    try {
      const customList = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
      if (customList && customList.length > 0) return customList
    } catch (_e) {}
    return wordsData.dictionaries.standard
  }
  return wordsData.dictionaries[dictionary] || wordsData.dictionaries.standard
}

function daysSinceEpoch(dateString) {
  return Math.floor(new Date(dateString).getTime() / 86400000)
}

const CUSTOM_DICT_EPOCH_KEY = 'lexi5_custom_dict_epoch'

// Anchors Custom's cycle to the day it was actually curated. Without this, "cycle
// number" would be days-since-1970 divided by list length — since we're ~20,000
// days past epoch, that's already several "cycles" for any list under a few
// thousand words, on the very day it's created. Built-in dictionaries don't need
// an anchor (anchor 0): they never get recreated, so absolute-epoch cycling is
// already correct and stable for them.
function getCustomDictionaryEpoch() {
  const stored = localStorage.getItem(CUSTOM_DICT_EPOCH_KEY)
  const parsed = Number(stored)
  if (stored !== null && !Number.isNaN(parsed)) return parsed
  // No anchor recorded yet (list curated before this existed, or first read this
  // session) — anchor to today instead of claiming staleness the list never earned.
  const today = daysSinceEpoch(new Date().toDateString())
  try { localStorage.setItem(CUSTOM_DICT_EPOCH_KEY, String(today)) } catch (_e) {}
  return today
}

export function getCustomDictionaryTheme() {
  return localStorage.getItem('lexi5_custom_dict_theme') || ''
}

// Call whenever a new Custom list is saved, so its cycle starts counting from today.
export function markCustomDictionaryCurated(theme = '') {
  try { 
    localStorage.setItem(CUSTOM_DICT_EPOCH_KEY, String(daysSinceEpoch(new Date().toDateString())))
    if (theme) {
      localStorage.setItem('lexi5_custom_dict_theme', theme)
    } else {
      localStorage.removeItem('lexi5_custom_dict_theme')
    }
  } catch (_e) {}
}

export function removeCustomDictionary() {
  try {
    localStorage.removeItem('lexi5_custom_dict')
    localStorage.removeItem(CUSTOM_DICT_EPOCH_KEY)
    localStorage.removeItem('lexi5_custom_dict_theme')
  } catch (_e) {}
}

// Where a given (date, iteration) falls in the list's non-repeating cycle:
// position advances by exactly 1 per calendar day (or extra same-day play), so
// every word in the list is guaranteed to appear exactly once before any repeat.
export function getWordProgress(dictionary = 'standard', dateString, iteration = 0) {
  const list = resolveDictionaryList(dictionary)
  const anchor = dictionary === 'custom' ? getCustomDictionaryEpoch() : 0
  const seq = (daysSinceEpoch(dateString) - anchor) + iteration
  const total = list.length
  const position = ((seq % total) + total) % total
  const cycleNumber = Math.floor(seq / total)
  return { position, total, cycleNumber, justWrapped: position === 0 && cycleNumber > 0 }
}

// Deterministic word based on local date, dictionary, and iteration. Pure function
// of its inputs (needed so shared/seeded game links resolve to the same word), but
// picks from a per-list shuffled order so words don't repeat until the whole list cycles.
export function getWord(dictionary = 'standard', dateString, iteration = 0) {
  const list = resolveDictionaryList(dictionary)
  const { position, cycleNumber } = getWordProgress(dictionary, dateString, iteration)
  const order = getShuffledOrder(list, cycleNumber)
  return list[order[position]]
}

export function parseSeed(seedStr) {
  try {
    const decoded = atob(seedStr)
    const [date, iterationStr, dictionary] = decoded.split('|')
    if (date && iterationStr && dictionary) {
      return { date, iteration: parseInt(iterationStr, 10), dictionary }
    }
  } catch (_e) {
    // ignore invalid seeds
  }
  return null
}

export function isValidGuess(word) {
  try {
    const customList = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
    if (customList && customList.includes(word)) return true
  } catch (_e) {}
  
  return wordsData.guesses.includes(word)
}

// Reads and migrates the stored stats blob (pure — no writes).
function loadStats() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATS_KEY) || 'null')
    if (stored) {
      // Migration from non-dictionary stats
      if (stored.gamesPlayed !== undefined) {
        return {
          ...DEFAULT_STATS,
          standard: { ...DEFAULT_STATS_DICT, ...stored }
        }
      }
      return {
        ...DEFAULT_STATS,
        lite: { ...DEFAULT_STATS_DICT, ...(stored.lite || {}) },
        standard: { ...DEFAULT_STATS_DICT, ...(stored.standard || {}) },
        expanded: { ...DEFAULT_STATS_DICT, ...(stored.expanded || {}) },
        expert: { ...DEFAULT_STATS_DICT, ...(stored.expert || {}) },
        custom: { ...DEFAULT_STATS_DICT, ...(stored.custom || {}) },
      }
    }
    return DEFAULT_STATS
  } catch {
    return DEFAULT_STATS
  }
}

// Folds a loss for a game abandoned mid-play (left unfinished past midnight) into a
// stats object, using the same shape updateStats writes, so it surfaces in Stats (pure).
function applyAbandonedLoss(statsObj, dict, wasCrown) {
  const prevDict = dict || 'standard'
  const dictStats = { ...DEFAULT_STATS_DICT, ...(statsObj[prevDict] || {}) }
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
// unfinished past midnight, the abandonment info needed to record it as a loss.
function computeInitialGame(difficulty, dictionary, urlSeed) {
  const today = new Date().toDateString()
  const parsedSeed = urlSeed ? parseSeed(urlSeed) : null
  const freshState = {
    date: today,
    iteration: 0,
    guesses: [],
    status: 'playing', // 'playing', 'won', 'lost'
    difficulty,
    dictionary: normalizeDictionary(dictionary)
  }

  try {
    const stored = JSON.parse(localStorage.getItem(GAME_KEY))

    if (parsedSeed) {
      // If resuming the exact seeded game, load it
      if (stored && stored.date === parsedSeed.date && stored.iteration === parsedSeed.iteration && stored.dictionary === parsedSeed.dictionary) {
        return { state: stored, abandonment: null }
      }
      // Otherwise start fresh with the seed
      return {
        state: {
          date: parsedSeed.date,
          iteration: parsedSeed.iteration,
          guesses: [],
          status: 'playing',
          difficulty,
          dictionary: normalizeDictionary(parsedSeed.dictionary)
        },
        abandonment: null
      }
    }

    // Normal flow (no seed):
    // Only resume if it's the same day.
    // If it's a new day, the old game is discarded (reset at midnight).
    // If the old game was still in progress and they had guessed at least once, count it as a loss.
    let abandonment = null
    if (stored && stored.date !== today && stored.status === 'playing' && stored.guesses.length > 0) {
      abandonment = { dict: stored.dictionary, wasCrown: stored.iteration === 0 }
    }

    if (stored && stored.date === today) {
      // If they changed settings but haven't started playing, apply them.
      // Otherwise, keep the locked settings for the in-progress game.
      if (stored.guesses.length === 0) {
        return { state: { ...stored, difficulty, dictionary: normalizeDictionary(dictionary) }, abandonment }
      }
      return { state: stored, abandonment }
    }

    return { state: freshState, abandonment }
  } catch (_e) {
    return { state: freshState, abandonment: null }
  }
}

export function useGameState(difficulty, dictionary, urlSeed = null) {
  // Computed once per mount (both calls are pure and read the same localStorage
  // snapshot), so the abandoned-game stats adjustment lands in `stats`' own
  // initializer instead of racing the `stats` write-back effect below.
  const [stats, setStats] = useState(() => {
    const base = loadStats()
    const { abandonment } = computeInitialGame(difficulty, dictionary, urlSeed)
    return abandonment ? applyAbandonedLoss(base, abandonment.dict, abandonment.wasCrown) : base
  })

  const [gameState, setGameState] = useState(() => computeInitialGame(difficulty, dictionary, urlSeed).state)

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  }, [stats])

  useEffect(() => {
    localStorage.setItem(GAME_KEY, JSON.stringify(gameState))
  }, [gameState])

  const addGuess = (guess, word) => {
    if (gameState.status !== 'playing') return

    const newGuesses = [...gameState.guesses, guess]
    const won = guess === word
    const lost = newGuesses.length >= 6 && !won
    
    let newStatus = 'playing'
    if (won) newStatus = 'won'
    else if (lost) newStatus = 'lost'

    setGameState(prev => ({
      ...prev,
      guesses: newGuesses,
      status: newStatus
    }))

    if (newStatus !== 'playing') {
      updateStats(won, newGuesses.length, gameState.dictionary)
    }
  }

  const forfeitGame = () => {
    if (gameState.status !== 'playing') return
    const newState = { ...gameState, status: 'lost' }
    setGameState(newState)
    localStorage.setItem(GAME_KEY, JSON.stringify(newState))
    updateStats(false, gameState.guesses.length, gameState.dictionary)
  }

  const resetStats = () => {
    localStorage.removeItem(STATS_KEY)
    setStats({ ...DEFAULT_STATS })
  }

  const startNextGame = (currentDifficulty, currentDictionary) => {
    const today = new Date().toDateString()
    setGameState(prev => ({
      date: today,
      iteration: prev.date === today ? prev.iteration + 1 : 0,
      guesses: [],
      status: 'playing',
      difficulty: currentDifficulty,
      dictionary: normalizeDictionary(currentDictionary)
    }))
  }

  // Switching dictionaries mid-game abandons the current puzzle (with no stats
  // penalty — it wasn't forfeited, the player just picked a different word list)
  // and deals a fresh word from the new dictionary right away.
  const switchDictionary = (newDictionary) => {
    setGameState(prev => ({
      date: new Date().toDateString(),
      iteration: 0,
      guesses: [],
      status: 'playing',
      difficulty: prev.difficulty,
      dictionary: normalizeDictionary(newDictionary)
    }))
  }

  const updateStats = (won, numGuesses, dict) => {
    if (won && gameState.iteration === 0) {
      try {
        const history = JSON.parse(localStorage.getItem('lexi5_history') || '{}')
        history[`${dict}:${gameState.date}`] = true
        localStorage.setItem('lexi5_history', JSON.stringify(history))
      } catch (_e) {}
    }

    setStats(prev => {
      const dictStats = prev[dict] || DEFAULT_STATS_DICT
      const currentStreak = won ? dictStats.currentStreak + 1 : 0
      
      const isCrown = gameState.iteration === 0
      const crownCurrentStreak = isCrown ? (won ? (dictStats.crownCurrentStreak || 0) + 1 : 0) : dictStats.crownCurrentStreak
      
      return {
        ...prev,
        [dict]: {
          ...dictStats,
          gamesPlayed: dictStats.gamesPlayed + 1,
          gamesWon: dictStats.gamesWon + (won ? 1 : 0),
          crownGamesPlayed: dictStats.crownGamesPlayed + (isCrown ? 1 : 0),
          crownGamesWon: dictStats.crownGamesWon + (isCrown && won ? 1 : 0),
          currentStreak,
          maxStreak: Math.max(dictStats.maxStreak, currentStreak),
          crownCurrentStreak,
          crownMaxStreak: Math.max(dictStats.crownMaxStreak || 0, crownCurrentStreak || 0),
          guesses: won ? { ...dictStats.guesses, [numGuesses]: dictStats.guesses[numGuesses] + 1 } : dictStats.guesses
        }
      }
    })
  }
  return { gameState, stats, addGuess, startNextGame, switchDictionary, forfeitGame, resetStats }
}

export function wasGameWon(dictionary, dateString) {
  try {
    const history = JSON.parse(localStorage.getItem('lexi5_history') || '{}')
    return !!history[`${dictionary}:${dateString}`]
  } catch (_e) {
    return false
  }
}
