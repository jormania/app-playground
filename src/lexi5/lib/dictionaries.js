import { readJson, writeJson, removeJson } from '../../shared/storage'
import { daysSinceEpoch } from './dateKey'

/**
 * The built-in word lists, and the whole lifecycle of the user's curated Custom list.
 *
 * The four answer lists and the 13,106-word guess list used to be one statically-imported
 * `words.json` — 277 KB raw, 97 KB gzipped, all of it in the initial bundle for a game
 * that only ever uses one dictionary at a time. They are separate chunks now, fetched on
 * demand.
 *
 * There is deliberately **no fallback to another list** when one hasn't loaded: which list
 * is in memory decides which word the day serves, so quietly substituting Standard would
 * hand the player a different puzzle. Callers must load first — `main.jsx` blocks the
 * first render on the active dictionary, and switching awaits the new one.
 */

const LOADERS = {
  lite: () => import('../data/dict-lite.json'),
  standard: () => import('../data/dict-standard.json'),
  expanded: () => import('../data/dict-expanded.json'),
  expert: () => import('../data/dict-expert.json'),
}

// Sizes are needed synchronously (the dictionary dropdown labels them) but are just four
// numbers, so they're inlined rather than dragging in the lists that would answer them.
export const DICTIONARY_SIZES = {
  lite: 344,
  standard: 2309,
  expanded: 5757,
  expert: 13106,
}

const loadedLists = new Map()
let loadedGuesses = null

/** Fetches a built-in list into memory. Idempotent; resolves immediately once cached. */
export async function loadDictionary(dictionary) {
  if (dictionary === 'custom') return
  if (loadedLists.has(dictionary)) return
  const load = LOADERS[dictionary] || LOADERS.standard
  const mod = await load()
  loadedLists.set(dictionary, mod.default)
}

/** Fetches the allowed-guess list, needed the first time a guess is submitted. */
export async function loadGuesses() {
  if (loadedGuesses) return
  const mod = await import('../data/guesses.json')
  loadedGuesses = new Set(mod.default)
}

/** True once this dictionary can be served without substituting a different one. */
export function isDictionaryLoaded(dictionary) {
  return dictionary === 'custom' ? true : loadedLists.has(dictionary)
}

const CUSTOM_DICT_KEY = 'lexi5_custom_dict'
const CUSTOM_DICT_THEME_KEY = 'lexi5_custom_dict_theme'
const CUSTOM_DICT_EPOCH_KEY = 'lexi5_custom_dict_epoch'

export const BUILTIN_DICTIONARY_ORDER = ['lite', 'standard', 'expanded', 'expert']

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
    // normalizeDictionary already redirects an empty Custom to Standard before this is
    // reached; if we somehow get here, Standard is the documented fallback.
    return loadedLists.get('standard') || []
  }
  const list = loadedLists.get(dictionary)
  if (list) return list
  // Loading is the caller's job (see the module comment). Returning some *other*
  // dictionary here would silently change which word the day serves.
  return loadedLists.get('standard') || []
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

export function isValidGuess(word) {
  const customList = getCustomList()
  if (customList && customList.includes(word)) return true
  // A Set rather than the old `Array.includes` scan over 13,106 entries on every Enter.
  return loadedGuesses ? loadedGuesses.has(word) : false
}

