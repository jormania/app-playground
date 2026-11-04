import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Same stub shape as store.test.js and drafts.test.js, this app's house style (R-017).
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import { TERMS, LEXICON_KEY, DEFAULT_VOICE, pickLexicon, loadVoice, saveVoice } from './lexicon.js'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', localStorageStub)
})

describe('the term table', () => {
  it('gives every key both voices, as non-empty strings', () => {
    for (const [key, pair] of Object.entries(TERMS)) {
      expect(Object.keys(pair).sort(), key).toEqual(['loom', 'plain'])
      expect(typeof pair.loom, key).toBe('string')
      expect(pair.loom.length, key).toBeGreaterThan(0)
      expect(typeof pair.plain, key).toBe('string')
      expect(pair.plain.length, key).toBeGreaterThan(0)
    }
  })

  it('defaults to the loom voice', () => {
    expect(DEFAULT_VOICE).toBe('loom')
  })
})

describe('pickLexicon', () => {
  it('returns the same keys for both voices', () => {
    expect(Object.keys(pickLexicon('plain'))).toEqual(Object.keys(pickLexicon('loom')))
    expect(Object.keys(pickLexicon('loom'))).toEqual(Object.keys(TERMS))
  })

  it('picks each voice\'s wording', () => {
    expect(pickLexicon('loom').thread).toBe('thread')
    expect(pickLexicon('plain').thread).toBe('task')
  })

  it('falls back to the loom voice for an unknown or missing voice', () => {
    expect(pickLexicon('klingon')).toEqual(pickLexicon('loom'))
    expect(pickLexicon(undefined)).toEqual(pickLexicon('loom'))
  })

  it('leaks no loom-house word into plain mode for the core nouns', () => {
    const plain = pickLexicon('plain')
    for (const key of ['thread', 'skein', 'Thread', 'Skein', 'guild', 'distaff']) {
      expect(plain[key], key).not.toBe(pickLexicon('loom')[key])
    }
  })
})

describe('loadVoice / saveVoice', () => {
  it('reads the default when nothing is stored', () => {
    expect(loadVoice()).toBe('loom')
  })

  it('round-trips both voices', () => {
    saveVoice('plain')
    expect(loadVoice()).toBe('plain')
    saveVoice('loom')
    expect(loadVoice()).toBe('loom')
  })

  it('ignores a stored value that is not a voice', () => {
    store[LEXICON_KEY] = 'pirate'
    expect(loadVoice()).toBe('loom')
  })

  it('stores an unknown voice as loom', () => {
    saveVoice('pirate')
    expect(store[LEXICON_KEY]).toBe('loom')
  })

  it('survives a throwing localStorage', () => {
    const boom = () => { throw new Error('denied') }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    expect(loadVoice()).toBe('loom')
    expect(() => saveVoice('plain')).not.toThrow()
  })
})
