import wordsData from '../data/words.json'
import { readJson, writeJson, removeJson } from '../../shared/storage'
import { daysSinceEpoch } from './dateKey'

/** The built-in word lists, and the whole lifecycle of the user's curated Custom list. */

const CUSTOM_DICT_KEY = 'lexi5_custom_dict'
const CUSTOM_DICT_THEME_KEY = 'lexi5_custom_dict_theme'
const CUSTOM_DICT_EPOCH_KEY = 'lexi5_custom_dict_epoch'

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
  const customList = readJson(CUSTOM_DICT_KEY, null)
  return !!(customList && customList.length > 0)
}

export function getCustomDictionarySize() {
  const customList = readJson(CUSTOM_DICT_KEY, null)
  return customList ? customList.length : 0
}

/** The curated list itself, or null. Read-only — use saveCustomDictionary to change it. */
export function getCustomDictionaryWords() {
  return getCustomList()
}

// A dictionary of 'custom' with no curated list yet isn't playable — fall back to
// Standard rather than silently serving Standard words under the 'custom' label.
export function normalizeDictionary(dictionary) {
  if (dictionary === 'custom' && !hasCustomDictionary()) return 'standard'
  return dictionary
}

// resolveDictionaryList runs from getWord/getWordProgress, which are called during
// render — so an unmemoised JSON.parse of a list up to 1,000 words long was happening
// several times per frame. Cached against the raw string, which only changes on curation.
let customListCache = { raw: null, parsed: null }

function getCustomList() {
  let raw = null
  try {
    raw = typeof localStorage !== 'undefined' && localStorage ? localStorage.getItem(CUSTOM_DICT_KEY) : null
  } catch (_e) {
    return null
  }
  if (raw === null) return null
  if (customListCache.raw === raw) return customListCache.parsed
  const parsed = readJson(CUSTOM_DICT_KEY, null)
  customListCache = { raw, parsed }
  return parsed
}

function invalidateCustomListCache() {
  customListCache = { raw: null, parsed: null }
}

export function resolveDictionaryList(dictionary) {
  if (dictionary === 'custom') {
    const customList = getCustomList()
    if (customList && customList.length > 0) return customList
    return wordsData.dictionaries.standard
  }
  return wordsData.dictionaries[dictionary] || wordsData.dictionaries.standard
}

// thousand words, on the very day it's created. Built-in dictionaries don't need
// an anchor (anchor 0): they never get recreated, so absolute-epoch cycling is
// already correct and stable for them.
// Pure read — no write. This is reached from getWordProgress, which App calls during
// render to decide whether to show the stale-list banner; persisting from there was a
// side effect in render (and ran twice per render under StrictMode).
export function getCustomDictionaryEpoch() {
  const stored = readJson(CUSTOM_DICT_EPOCH_KEY, null)
  const parsed = Number(stored)
  if (stored !== null && !Number.isNaN(parsed)) return parsed
  // No anchor recorded yet (list curated before this existed) — treat today as the
  // anchor so the list isn't accused of staleness it never earned. The value is
  // persisted separately by ensureCustomDictionaryAnchor(), from an effect.
  return daysSinceEpoch(new Date().toDateString())
}

/** Persists today as the anchor if none is recorded. Safe to call repeatedly; must be
 *  called from an effect or event handler, never from render. */
export function ensureCustomDictionaryAnchor() {
  const stored = readJson(CUSTOM_DICT_EPOCH_KEY, null)
  if (stored !== null && !Number.isNaN(Number(stored))) return
  writeJson(CUSTOM_DICT_EPOCH_KEY, daysSinceEpoch(new Date().toDateString()))
}

// Crown wins are recorded per dictionary per day and were never pruned, while the only
// reader (the Archive) looks back 14 days. Keeps a month so the Archive's window is

export function getCustomDictionaryTheme() {
  return readJson(CUSTOM_DICT_THEME_KEY, '') || ''
}

// Call whenever a new Custom list is saved, so its cycle starts counting from today.
export function markCustomDictionaryCurated(theme = '') {
  writeJson(CUSTOM_DICT_EPOCH_KEY, daysSinceEpoch(new Date().toDateString()))
  if (theme) writeJson(CUSTOM_DICT_THEME_KEY, theme)
  else removeJson(CUSTOM_DICT_THEME_KEY)
  invalidateCustomListCache()
}

export function removeCustomDictionary() {
  removeJson(CUSTOM_DICT_KEY)
  removeJson(CUSTOM_DICT_EPOCH_KEY)
  removeJson(CUSTOM_DICT_THEME_KEY)
  invalidateCustomListCache()
}

/** Persists a freshly curated list. Returns false if storage refused the write (private
 *  mode, quota) so the caller can tell the player rather than claiming success. */
export function saveCustomDictionary(words) {
  const ok = writeJson(CUSTOM_DICT_KEY, words)
  invalidateCustomListCache()
  return ok
}

// Where a given (date, iteration) falls in the list's non-repeating cycle, for progress/
// staleness *reporting* — the Custom "you've used every word" banner, the toasts, and

const GUESS_SET = new Set(wordsData.guesses)

export function isValidGuess(word) {
  const customList = getCustomList()
  if (customList && customList.includes(word)) return true
  return GUESS_SET.has(word)
}

