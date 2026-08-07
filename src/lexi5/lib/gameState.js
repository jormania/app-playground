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
  standard: { ...DEFAULT_STATS_DICT },
  expanded: { ...DEFAULT_STATS_DICT },
  expert: { ...DEFAULT_STATS_DICT }
}

// Deterministic daily word based on local date, dictionary, and iteration
export function getWord(dictionary = 'standard', dateString, iteration = 0) {
  // Simple hash for the date string and iteration
  const seedString = `${dateString}-${iteration}`
  let hash = 0
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  
  const list = wordsData.dictionaries[dictionary] || wordsData.dictionaries.standard
  const index = Math.abs(hash) % list.length
  return list[index]
}

export function parseSeed(seedStr) {
  try {
    const decoded = atob(seedStr)
    const [date, iterationStr, dictionary] = decoded.split('|')
    if (date && iterationStr && dictionary) {
      return { date, iteration: parseInt(iterationStr, 10), dictionary }
    }
  } catch (e) {
    // ignore invalid seeds
  }
  return null
}

export function isValidGuess(word) {
  return wordsData.guesses.includes(word)
}

export function useGameState(difficulty, dictionary, urlSeed = null) {
  const [stats, setStats] = useState(() => {
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
          standard: { ...DEFAULT_STATS_DICT, ...(stored.standard || {}) },
          expanded: { ...DEFAULT_STATS_DICT, ...(stored.expanded || {}) },
          expert: { ...DEFAULT_STATS_DICT, ...(stored.expert || {}) },
        }
      }
      return DEFAULT_STATS
    } catch {
      return DEFAULT_STATS
    }
  })

  const [gameState, setGameState] = useState(() => {
    const today = new Date().toDateString()
    
    // If a valid URL seed is provided, prioritize it for the game state
    const parsedSeed = urlSeed ? parseSeed(urlSeed) : null
    
    try {
      const stored = JSON.parse(localStorage.getItem(GAME_KEY))
      
      if (parsedSeed) {
        // If resuming the exact seeded game, load it
        if (stored && stored.date === parsedSeed.date && stored.iteration === parsedSeed.iteration && stored.dictionary === parsedSeed.dictionary) {
          return stored
        }
        // Otherwise start fresh with the seed
        return {
          date: parsedSeed.date,
          iteration: parsedSeed.iteration,
          guesses: [],
          status: 'playing',
          difficulty,
          dictionary: parsedSeed.dictionary
        }
      }

      // Normal flow (no seed):
      // Only resume if it's the same day. 
      // If it's a new day, the old game is discarded (reset at midnight).
      if (stored && stored.date === today) {
        // If they changed settings but haven't started playing, apply them.
        // Otherwise, keep the locked settings for the in-progress game.
        if (stored.guesses.length === 0) {
          return { ...stored, difficulty, dictionary }
        }
        return stored
      }
    } catch (_e) {
      // ignore
    }
    
    return {
      date: today,
      iteration: 0,
      guesses: [],
      status: 'playing', // 'playing', 'won', 'lost'
      difficulty,
      dictionary
    }
  })

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
    setGameState(prev => ({
      ...prev,
      status: 'lost'
    }))
    updateStats(false, 6, gameState.dictionary)
  }

  const startNextGame = (currentDifficulty, currentDictionary) => {
    const today = new Date().toDateString()
    setGameState(prev => ({
      date: today,
      iteration: prev.date === today ? prev.iteration + 1 : 0,
      guesses: [],
      status: 'playing',
      difficulty: currentDifficulty,
      dictionary: currentDictionary
    }))
  }

  const updateStats = (won, numGuesses, dict) => {
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

  return { gameState, stats, addGuess, startNextGame, forfeitGame }
}
