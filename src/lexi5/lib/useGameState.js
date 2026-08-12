import { useState, useEffect } from 'react'
import { readJson, writeJson } from '../../shared/storage'
import { normalizeDictionary, hasCustomDictionary, ensureCustomDictionaryAnchor } from './dictionaries'
import { parseSeed } from './words'
import { recordFinishedGame } from './sessionRun'
import {
  STATS_KEY,
  makeDictStats,
  makeDefaultStats,
  loadStats,
  applyAbandonedLoss,
  recordCrownWin,
  wasGameWon,
} from './stats'

/** The live game: today's board, the stats it feeds, and the actions that change both. */

const GAME_KEY = 'lexi5_game'
const ENDLESS_PROGRESS_KEY = 'lexi5_endless_progress'

function getEndlessProgress(dictionary) {
  const progress = readJson(ENDLESS_PROGRESS_KEY, {})
  return progress[dictionary] || 0
}

function incrementEndlessProgress(dictionary) {
  const progress = readJson(ENDLESS_PROGRESS_KEY, {})
  progress[dictionary] = (progress[dictionary] || 0) + 1
  writeJson(ENDLESS_PROGRESS_KEY, progress)
}

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
    const stored = readJson(GAME_KEY, null)

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
    writeJson(STATS_KEY, stats)
  }, [stats])

  useEffect(() => {
    writeJson(GAME_KEY, gameState)
  }, [gameState])

  // Self-heals a Custom list saved before the cycle anchor existed. Done here rather
  // than lazily inside the epoch getter, which is reached from render.
  useEffect(() => {
    if (hasCustomDictionary()) ensureCustomDictionaryAnchor()
  }, [gameState.dictionary])

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
    // No manual write here — the persistence effect above already mirrors every
    // gameState change, and writing twice just risks the two shapes diverging.
    setGameState({ ...gameState, status: 'lost' })
    updateStats(false, gameState.guesses.length, gameState.dictionary)
  }

  const resetStats = () => {
    // No removeItem: the write-back effect repopulates the key on the very next commit,
    // so removing it first only implied a clean slate it never actually delivered.
    setStats(makeDefaultStats())
  }

  const startNextGame = (currentDifficulty, currentDictionary) => {
    const today = new Date().toDateString()
    const dictStr = normalizeDictionary(currentDictionary)

    setGameState(prev => {
      let nextIter = 0
      if (prev.date === today) {
        // Continuing same-day session: if we are finishing the Daily Word (0), or already in Endless (>0)
        // advance the endless counter.
        incrementEndlessProgress(dictStr)
        nextIter = Math.max(1, getEndlessProgress(dictStr))
      } else {
        // New day! But check if they already beat this dictionary's daily word on another device/session today
        if (wasGameWon(dictStr, today)) {
          incrementEndlessProgress(dictStr)
          nextIter = Math.max(1, getEndlessProgress(dictStr))
        }
      }

      return {
        date: today,
        iteration: nextIter,
        guesses: [],
        status: 'playing',
        difficulty: currentDifficulty,
        dictionary: dictStr
      }
    })
  }

  // Switching dictionaries mid-game abandons the current puzzle (with no stats
  // penalty — it wasn't forfeited, the player just picked a different word list)
  // and deals a fresh word from the new dictionary right away.
  const switchDictionary = (newDictionary) => {
    const today = new Date().toDateString()
    const dictStr = normalizeDictionary(newDictionary)

    setGameState(prev => {
      // Prevent the dictionary-toggle exploit: if they already won today's Daily Word for the
      // target dictionary, drop them straight into Endless mode so they don't get the Daily Word again.
      let nextIter = 0
      if (wasGameWon(dictStr, today)) {
        nextIter = Math.max(1, getEndlessProgress(dictStr))
      }

      return {
        date: today,
        iteration: nextIter,
        guesses: [],
        status: 'playing',
        difficulty: prev.difficulty,
        dictionary: dictStr
      }
    })
  }

  const updateStats = (won, numGuesses, dict) => {
    // Today's practice record, alongside the lifetime figures. Called from the same place
    // so a game can't land in one and not the other.
    recordFinishedGame(dict, won, gameState.date)

    if (won && gameState.iteration === 0) {
      recordCrownWin(dict, gameState.date)
    }

    setStats(prev => {
      const dictStats = prev[dict] || makeDictStats()
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
