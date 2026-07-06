import { describe, it, expect } from 'vitest'
import {
  loadPreset,
  savePreset,
  nextPreset,
  modeOf,
  presetById,
  PRESETS,
  DEFAULT_PRESET,
  THEME_KEY,
} from './theme.js'

function memStore(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, v),
  }
}

describe('theme presets', () => {
  it('has 6 presets: 3 light + 3 dark, strictly alternating, unique ids', () => {
    expect(PRESETS).toHaveLength(6)
    expect(PRESETS.filter((p) => p.mode === 'light')).toHaveLength(3)
    expect(PRESETS.filter((p) => p.mode === 'dark')).toHaveLength(3)
    // Alternates so each header press flips light↔dark.
    PRESETS.forEach((p, i) => {
      if (i > 0) expect(p.mode).not.toBe(PRESETS[i - 1].mode)
    })
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe(DEFAULT_PRESET)
  })

  it('defaults to the dark Solarized and reads a stored preset', () => {
    expect(loadPreset(memStore())).toBe('solarized-dark')
    expect(loadPreset(memStore({ [THEME_KEY]: 'spectrum' }))).toBe('spectrum')
    expect(loadPreset(memStore({ [THEME_KEY]: 'quiet-light' }))).toBe('quiet-light')
  })

  it('migrates the legacy light/dark prefs and rejects nonsense', () => {
    expect(loadPreset(memStore({ [THEME_KEY]: 'light' }))).toBe('solarized-light')
    expect(loadPreset(memStore({ [THEME_KEY]: 'dark' }))).toBe('solarized-dark')
    expect(loadPreset(memStore({ [THEME_KEY]: 'nonsense' }))).toBe('solarized-dark')
  })

  it('round-trips via save', () => {
    const store = memStore()
    savePreset('octagon', store)
    expect(loadPreset(store)).toBe('octagon')
    savePreset('filter-sun', store)
    expect(loadPreset(store)).toBe('filter-sun')
  })

  it('nextPreset walks the cycle in order and wraps', () => {
    const order = PRESETS.map((p) => p.id)
    order.forEach((id, i) => {
      expect(nextPreset(id)).toBe(order[(i + 1) % order.length])
    })
    expect(nextPreset(order[order.length - 1])).toBe(order[0])
  })

  it('modeOf reports each preset mode; presetById falls back to the default', () => {
    expect(modeOf('solarized-light')).toBe('light')
    expect(modeOf('octagon')).toBe('dark')
    expect(presetById('spectrum').id).toBe('spectrum')
    expect(presetById('who-knows').id).toBe(DEFAULT_PRESET)
    expect(presetById(null).id).toBe(DEFAULT_PRESET)
  })
})
