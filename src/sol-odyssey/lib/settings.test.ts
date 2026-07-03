import { describe, it, expect } from 'vitest'
import {
  EMPTY_SETTINGS,
  clearSettings,
  isConfigured,
  loadSettings,
  saveSettings,
  STORAGE_KEY,
} from './settings'

/** Minimal in-memory localStorage stand-in (no jsdom needed). */
function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    raw: map,
  }
}

describe('settings storage', () => {
  it('returns the empty shape when nothing is stored', () => {
    expect(loadSettings(memStorage())).toEqual(EMPTY_SETTINGS)
  })

  it('round-trips a save → load and trims whitespace', () => {
    const store = memStorage()
    saveSettings({ token: '  ntn_abc  ', dsOdysseys: ' 48cb ' }, store)
    const loaded = loadSettings(store)
    expect(loaded.token).toBe('ntn_abc')
    expect(loaded.dsOdysseys).toBe('48cb')
    expect(loaded.dsCheckins).toBe('')
  })

  it('merges partial saves over existing values', () => {
    const store = memStorage()
    saveSettings({ token: 't1', dsOdysseys: 'o1' }, store)
    saveSettings({ dsCheckins: 'c1' }, store)
    const loaded = loadSettings(store)
    expect(loaded).toMatchObject({ token: 't1', dsOdysseys: 'o1', dsCheckins: 'c1' })
  })

  it('falls back to empty on corrupt JSON', () => {
    const store = memStorage({ [STORAGE_KEY]: '{not json' })
    expect(loadSettings(store)).toEqual(EMPTY_SETTINGS)
  })

  it('ignores unknown keys in stored payloads', () => {
    const store = memStorage({ [STORAGE_KEY]: JSON.stringify({ token: 't', bogus: 'x' }) })
    const loaded = loadSettings(store) as unknown as Record<string, unknown>
    expect(loaded.token).toBe('t')
    expect(loaded.bogus).toBeUndefined()
  })

  it('round-trips the boolean guidance toggles and defaults them to true', () => {
    const store = memStorage()
    // Defaults before anything is saved.
    expect(loadSettings(store).showGuidance).toBe(true)
    expect(loadSettings(store).showLanding).toBe(true)
    // Persist a flip and read it back.
    saveSettings({ showGuidance: false }, store)
    const loaded = loadSettings(store)
    expect(loaded.showGuidance).toBe(false)
    expect(loaded.showLanding).toBe(true)
  })

  it('defaults the state check-in ritual to off and round-trips it', () => {
    const store = memStorage()
    expect(loadSettings(store).stateCheckinEnabled).toBe(false)
    saveSettings({ stateCheckinEnabled: true }, store)
    expect(loadSettings(store).stateCheckinEnabled).toBe(true)
  })

  it('coerces a non-boolean stored toggle back to its default', () => {
    const store = memStorage({
      [STORAGE_KEY]: JSON.stringify({ showGuidance: 'nope' }),
    })
    expect(loadSettings(store).showGuidance).toBe(true)
  })

  it('clears stored settings', () => {
    const store = memStorage()
    saveSettings({ token: 't' }, store)
    clearSettings(store)
    expect(loadSettings(store)).toEqual(EMPTY_SETTINGS)
  })

  it('does not throw when no storage backend exists', () => {
    expect(() => saveSettings({ token: 't' })).not.toThrow()
    expect(loadSettings()).toEqual(EMPTY_SETTINGS)
  })
})

describe('isConfigured', () => {
  it('is false until token + all three IDs are present', () => {
    expect(isConfigured(EMPTY_SETTINGS)).toBe(false)
    expect(
      isConfigured({ ...EMPTY_SETTINGS, token: 't', dsOdysseys: 'o', dsCheckins: 'c' }),
    ).toBe(false)
  })

  it('is true with token + all three IDs (buddy fields not required)', () => {
    expect(
      isConfigured({
        ...EMPTY_SETTINGS,
        token: 't',
        dsOdysseys: 'o',
        dsCheckins: 'c',
        dsReflections: 'r',
      }),
    ).toBe(true)
  })

  it('treats whitespace-only values as missing', () => {
    expect(
      isConfigured({
        ...EMPTY_SETTINGS,
        token: '   ',
        dsOdysseys: 'o',
        dsCheckins: 'c',
        dsReflections: 'r',
      }),
    ).toBe(false)
  })
})
