import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Same stub shape as lexicon.test.js and store.test.js, this app's house style (R-017).
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import { UI_STYLES, UISTYLE_KEY, DEFAULT_UISTYLE, loadUiStyle, saveUiStyle } from './uiStyle.js'

const LEGACY_KEY = 'loom:barstyle'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', localStorageStub)
})

describe('the style table', () => {
  it('has unique ids and includes the default', () => {
    const ids = UI_STYLES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_UISTYLE)
    for (const s of UI_STYLES) expect(s.name.length).toBeGreaterThan(0)
  })
})

describe('loadUiStyle', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadUiStyle()).toBe(DEFAULT_UISTYLE)
    expect(DEFAULT_UISTYLE).toBe('row') // the slim row is the documented default
  })

  it('returns a stored valid style', () => {
    for (const { id } of UI_STYLES) {
      store[UISTYLE_KEY] = id
      expect(loadUiStyle()).toBe(id)
    }
  })

  it('ignores a stored value that is not a known style', () => {
    store[UISTYLE_KEY] = 'neon'
    expect(loadUiStyle()).toBe(DEFAULT_UISTYLE)
  })

  it('carries over a valid pre-coordination choice', () => {
    store[LEGACY_KEY] = 'tabs'
    expect(loadUiStyle()).toBe('tabs')
  })

  it('prefers the current key over the legacy one', () => {
    store[UISTYLE_KEY] = 'pill'
    store[LEGACY_KEY] = 'tabs'
    expect(loadUiStyle()).toBe('pill')
  })

  it('ignores an invalid legacy value', () => {
    store[LEGACY_KEY] = 'neon'
    expect(loadUiStyle()).toBe(DEFAULT_UISTYLE)
  })

  it('falls back to the default when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') } })
    expect(loadUiStyle()).toBe(DEFAULT_UISTYLE)
  })
})

describe('saveUiStyle', () => {
  it('round-trips through loadUiStyle', () => {
    saveUiStyle('pill')
    expect(store[UISTYLE_KEY]).toBe('pill')
    expect(loadUiStyle()).toBe('pill')
  })

  it('does not throw when storage throws', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota') } })
    expect(() => saveUiStyle('tabs')).not.toThrow()
  })
})
