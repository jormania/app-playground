/**
 * Barrel for Lexi5's game logic.
 *
 * The implementation lives in focused modules alongside this file — dateKey, dictionaries,
 * words, stats and useGameState. This re-export keeps every existing import path (and the
 * whole existing test suite) working unchanged, which is what makes the split provably
 * behaviour-preserving. Same pattern the repo used when promoting useWakeLock to
 * src/shared. New code can import from the specific module instead.
 */

export { daysSinceEpoch } from './dateKey'

export {
  BUILTIN_DICTIONARY_ORDER,
  DICTIONARY_SIZES,
  DICTIONARY_LABELS,
  hasCustomDictionary,
  getCustomDictionarySize,
  getCustomDictionaryWords,
  getCustomDictionaryTheme,
  normalizeDictionary,
  markCustomDictionaryCurated,
  removeCustomDictionary,
  saveCustomDictionary,
  ensureCustomDictionaryAnchor,
  isValidGuess,
  loadDictionary,
  loadGuesses,
  isDictionaryLoaded,
} from './dictionaries'

export { getWordProgress, getWord, parseSeed } from './words'

export { wasGameWon, recordServedWord, getServedWord } from './stats'

export { getDayRecord, describeDay } from './sessionRun'

export { useGameState } from './useGameState'
