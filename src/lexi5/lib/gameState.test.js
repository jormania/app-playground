// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  getWord,
  getWordProgress,
  parseSeed,
  isValidGuess,
  useGameState,
  normalizeDictionary,
  hasCustomDictionary,
  getCustomDictionarySize,
  markCustomDictionaryCurated,
  DICTIONARY_SIZES,
  BUILTIN_DICTIONARY_ORDER
} from './gameState'
import wordData from '../data/words.json'

function addDays(dateString, days) {
  const d = new Date(dateString)
  d.setDate(d.getDate() + days)
  return d.toDateString()
}

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

describe('gameState logic', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('getWord generates a deterministic word based on seed data', () => {
    const word1 = getWord('standard', '2026-08-07', 0)
    const word2 = getWord('standard', '2026-08-07', 0)
    const word3 = getWord('standard', '2026-08-07', 1)

    expect(word1).toBeDefined()
    expect(typeof word1).toBe('string')
    expect(word1).toBe(word2)
    expect(word1).not.toBe(word3) // different iteration yields different word
  })

  it('getWord defaults to standard dictionary if missing', () => {
    const word1 = getWord('unknown_dict', '2026-08-07', 0)
    const word2 = getWord('standard', '2026-08-07', 0)
    expect(word1).toBe(word2)
  })

  it('parseSeed correctly decodes valid seeds', () => {
    // encode "2026-08-07|1|expanded"
    const validSeed = btoa('2026-08-07|1|expanded')
    const parsed = parseSeed(validSeed)

    expect(parsed).toEqual({
      date: '2026-08-07',
      iteration: 1,
      dictionary: 'expanded'
    })
  })

  it('parseSeed returns null for invalid seeds', () => {
    expect(parseSeed('invalid_base64_+++')).toBeNull()
    expect(parseSeed(btoa('missing_parts'))).toBeNull()
  })

  it('isValidGuess validates guesses against the dictionary', () => {
    expect(isValidGuess('apple')).toBe(true)
    expect(isValidGuess('zzzzz')).toBe(false) // Assuming zzzzz is not in the dictionary
  })

  describe('DICTIONARY_SIZES / BUILTIN_DICTIONARY_ORDER', () => {
    it('orders built-in dictionaries easiest to hardest', () => {
      expect(BUILTIN_DICTIONARY_ORDER).toEqual(['lite', 'standard', 'expanded', 'expert'])
    })

    it('reports strictly increasing sizes across the difficulty order', () => {
      const sizes = BUILTIN_DICTIONARY_ORDER.map(k => DICTIONARY_SIZES[k])
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
      }
    })
  })

  describe('no-repeat word cycle (getWordProgress / getWord)', () => {
    it('never repeats a word within a full cycle of the list', () => {
      const total = DICTIONARY_SIZES.lite
      const base = '2026-01-01'
      
      // Calculate the offset needed to start exactly at a cycle boundary
      const msPerDay = 1000 * 60 * 60 * 24
      const seq = Math.floor(new Date(base).getTime() / msPerDay)
      const offset = (total - (seq % total)) % total
      
      const words = new Set()
      for (let i = 0; i < total; i++) {
        // Because iteration > 0 now leaps to the endless queue, to simulate 
        // a pure continuous sequence on the calendar queue for the test, we 
        // must use iteration 0 and spoof the date string to advance by days.
        const mockDate = new Date(new Date(base).getTime() + (offset + i) * msPerDay).toDateString()
        words.add(getWord('lite', mockDate, 0))
      }
      // Compare against the actual number of unique words in the lite dictionary
      // in case the raw array has a duplicate.
      const liteUniqueSize = new Set(wordData.dictionaries.lite).size
      expect(words.size).toBe(liteUniqueSize)
    })

    it('reports position/cycle/justWrapped correctly at cycle boundaries', () => {
      const total = DICTIONARY_SIZES.lite
      const epoch = '1970-01-01' // daysSinceEpoch === 0
      
      const msPerDay = 1000 * 60 * 60 * 24
      // Day (total - 1)
      const dateLast = new Date(new Date(epoch).getTime() + (total - 1) * msPerDay).toDateString()
      const last = getWordProgress('lite', dateLast, 0)
      expect(last.position).toBe(total - 1)
      expect(last.cycleNumber).toBe(0)
      expect(last.justWrapped).toBe(false)

      // Day (total) - Wraps to next cycle
      const dateWrapped = new Date(new Date(epoch).getTime() + total * msPerDay).toDateString()
      const wrapped = getWordProgress('lite', dateWrapped, 0)
      expect(wrapped.position).toBe(0)
      expect(wrapped.cycleNumber).toBe(1)
      expect(wrapped.justWrapped).toBe(true)
    })

    it('gives every built-in dictionary at least one non-repeating stretch of days', () => {
      const base = '2026-01-01'
      const msPerDay = 1000 * 60 * 60 * 24
      const seq = Math.floor(new Date(base).getTime() / msPerDay)

      for (const dict of BUILTIN_DICTIONARY_ORDER) {
        const total = DICTIONARY_SIZES[dict]
        const offset = (total - (seq % total)) % total
        const sampleSize = Math.min(30, total)
        const words = new Set()
        for (let i = 0; i < sampleSize; i++) {
          const mockDate = new Date(new Date(base).getTime() + (offset + i) * msPerDay).toDateString()
          words.add(getWord(dict, mockDate, 0))
        }
        expect(words.size).toBe(sampleSize)
      }
    })
  })

  describe('custom dictionary fallback (normalizeDictionary / hasCustomDictionary)', () => {
    it('falls back "custom" to "standard" when no custom list is stored', () => {
      expect(hasCustomDictionary()).toBe(false)
      expect(normalizeDictionary('custom')).toBe('standard')
    })

    it('keeps "custom" once a non-empty custom list exists', () => {
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(['apple', 'mango']))
      expect(hasCustomDictionary()).toBe(true)
      expect(getCustomDictionarySize()).toBe(2)
      expect(normalizeDictionary('custom')).toBe('custom')
    })

    it('passes through non-custom dictionaries unchanged', () => {
      expect(normalizeDictionary('expert')).toBe('expert')
    })
  })

  describe('custom dictionary cycle anchoring (markCustomDictionaryCurated)', () => {
    it('a freshly curated list is not immediately "stale" despite being far past the Unix epoch', () => {
      // Without an anchor, cycleNumber = daysSinceEpoch / list.length — since we're
      // ~20,000 days past 1970, a small/freshly-made list would look already-cycled
      // on day one. This is the exact bug the anchor exists to prevent.
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(['apple', 'mango', 'grape']))
      const today = new Date().toDateString()
      markCustomDictionaryCurated()

      const progress = getWordProgress('custom', today, 0)
      expect(progress.cycleNumber).toBe(0)
      expect(progress.position).toBe(0)
      expect(progress.justWrapped).toBe(false)
    })

    it('only reports a wrapped cycle once every word has actually had a turn since curation', () => {
      const list = ['apple', 'mango', 'grape']
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(list))
      const today = new Date().toDateString()
      markCustomDictionaryCurated()

      const almostWrapped = getWordProgress('custom', addDays(today, list.length - 1), 0)
      expect(almostWrapped.cycleNumber).toBe(0)

      const wrapped = getWordProgress('custom', addDays(today, list.length), 0)
      expect(wrapped.cycleNumber).toBe(1)
      expect(wrapped.justWrapped).toBe(true)
    })

    it('self-heals a missing curation anchor instead of claiming instant staleness', () => {
      // Simulates a list saved before this anchor existed — no markCustomDictionaryCurated() call.
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(['apple', 'mango', 'grape']))
      const today = new Date().toDateString()

      const progress = getWordProgress('custom', today, 0)
      expect(progress.cycleNumber).toBe(0)
    })

    it('does not report a wrapped cycle in Endless mode until every word has actually had a turn', () => {
      // Regression: iteration>0 (Endless) used to fold a `total * 100` shuffle-distinctness
      // offset straight into cycleNumber, so cycleNumber was always >= 100 for ANY endless
      // game — meaning the "you've used every word" banner fired after just the second game
      // on a 27-word list, not after all 27 had actually been played.
      const list = ['apple', 'mango', 'grape']
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(list))
      markCustomDictionaryCurated()

      const today = new Date().toDateString()
      const secondEndlessGame = getWordProgress('custom', today, 2)
      expect(secondEndlessGame.cycleNumber).toBe(0)
      expect(secondEndlessGame.justWrapped).toBe(false)

      const afterFullLap = getWordProgress('custom', today, list.length + 1)
      expect(afterFullLap.cycleNumber).toBe(1)
      expect(afterFullLap.justWrapped).toBe(true)
    })

    it('gives Endless a different word order than Crown even on the same cycleNumber', () => {
      // Without a mode-distinct shuffle key, Endless game 1 (cycleNumber 0) would use the
      // exact same permutation as Crown's cycleNumber-0 stretch, so an early endless word
      // could spoil (exactly match) a future daily word.
      // (This particular list/size is chosen so Crown's and Endless's independently-seeded
      // permutations land on different words at position 0 — with a small list, two distinct
      // seeds can coincidentally agree at any one index, so an arbitrary list risks flaking.)
      const list = ['apple', 'mango', 'grape', 'peach', 'lemon', 'berry', 'melon']
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(list))
      markCustomDictionaryCurated()

      const crownWord = getWord('custom', new Date().toDateString(), 0)
      const endlessWord = getWord('custom', new Date().toDateString(), 1)
      // Both land on cycleNumber 0, position 0 of their own sequences — only the mode
      // tag on the shuffle key can make these differ.
      expect(getWordProgress('custom', new Date().toDateString(), 0).cycleNumber).toBe(0)
      expect(getWordProgress('custom', new Date().toDateString(), 1).cycleNumber).toBe(0)
      expect(crownWord).not.toBe(endlessWord)
    })

    it('Crown word derivation is byte-for-byte unchanged by the Endless mode tag', () => {
      // Regression guard: an earlier version of the Endless staleness fix (below) tagged
      // *every* shuffle-cache key with a mode, including Crown's — which reseeds the
      // shuffle for every date/dictionary Crown has ever served. Since Crown's word isn't
      // persisted (it's re-derived from (date, iteration) on every load — see App.jsx), that
      // would silently change the word under an in-progress game after deploy, make the
      // Archive's past-14-days lookup disagree with what was actually served, and break
      // previously shared Crown seed links. This reimplements the pre-fix shuffle exactly
      // (no mode segment in the key) and checks it still matches getWord's Crown output.
      function hashString(str) {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i)
          hash |= 0
        }
        return hash >>> 0
      }
      function mulberry32(seed) {
        let a = seed
        return function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0
          let t = Math.imul(a ^ (a >>> 15), 1 | a)
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      }
      function preFixCrownWord(list, cycleNumber, position) {
        const key = `${list.length}:${hashString(list.join(','))}:cycle:${cycleNumber}`
        const rand = mulberry32(hashString(key))
        const order = list.map((_, i) => i)
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1))
          ;[order[i], order[j]] = [order[j], order[i]]
        }
        return list[order[position]]
      }

      const dateString = '2026-08-11'
      const { position, cycleNumber } = getWordProgress('standard', dateString, 0)
      const expected = preFixCrownWord(wordData.dictionaries.standard, cycleNumber, position)
      expect(getWord('standard', dateString, 0)).toBe(expected)
    })
  })

  describe('useGameState', () => {
    it('normalizes an unusable "custom" dictionary to "standard" on init', () => {
      const { result } = renderHook(() => useGameState('normal', 'custom', null))
      expect(result.current.gameState.dictionary).toBe('standard')
    })

    it('records an abandoned in-progress game as a loss without crashing', () => {
      vi.setSystemTime(new Date('2020-01-02T12:00:00'))
      localStorage.setItem('lexi5_game', JSON.stringify({
        date: 'Wed Jan 01 2020',
        iteration: 0,
        guesses: ['apple'],
        status: 'playing',
        difficulty: 'normal',
        dictionary: 'standard'
      }))

      const { result } = renderHook(() => useGameState('normal', 'standard', null))

      // A fresh game should start today — the abandoned one is not resumed.
      expect(result.current.gameState.date).toBe(new Date().toDateString())
      expect(result.current.gameState.guesses).toEqual([])

      const stats = JSON.parse(localStorage.getItem('lexi5_stats'))
      expect(stats.standard.gamesPlayed).toBe(1)
      expect(stats.standard.currentStreak).toBe(0)
      expect(stats.standard.crownGamesPlayed).toBe(1) // iteration 0 === crown game
    })

    it('does not record a loss for a same-day in-progress game', () => {
      const today = new Date().toDateString()
      localStorage.setItem('lexi5_game', JSON.stringify({
        date: today,
        iteration: 0,
        guesses: ['apple'],
        status: 'playing',
        difficulty: 'normal',
        dictionary: 'standard'
      }))

      renderHook(() => useGameState('normal', 'standard', null))

      const stats = JSON.parse(localStorage.getItem('lexi5_stats'))
      expect(stats.standard.gamesPlayed).toBe(0)
    })

    it('switchDictionary starts a fresh game with no stats penalty', () => {
      const { result } = renderHook(() => useGameState('normal', 'standard', null))

      act(() => {
        result.current.addGuess('wrong', 'apple')
      })
      expect(result.current.gameState.guesses).toEqual(['wrong'])

      const statsBefore = JSON.parse(JSON.stringify(result.current.stats))

      act(() => {
        result.current.switchDictionary('expanded')
      })

      expect(result.current.gameState.dictionary).toBe('expanded')
      expect(result.current.gameState.guesses).toEqual([])
      expect(result.current.gameState.status).toBe('playing')
      expect(result.current.stats).toEqual(statsBefore)
    })
  })
})
