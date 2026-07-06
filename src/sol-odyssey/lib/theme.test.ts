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
  type PresetId,
} from './theme'

function memStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('theme presets', () => {
  it('has 8 presets: 4 light + 4 dark, strictly alternating, unique ids', () => {
    expect(PRESETS).toHaveLength(8)
    expect(PRESETS.filter((p) => p.mode === 'light')).toHaveLength(4)
    expect(PRESETS.filter((p) => p.mode === 'dark')).toHaveLength(4)
    // Alternates so each header press flips light↔dark.
    PRESETS.forEach((p, i) => {
      if (i > 0) expect(p.mode).not.toBe(PRESETS[i - 1]!.mode)
    })
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe(DEFAULT_PRESET)
  })

  it('defaults to indigo-light and reads a stored preset', () => {
    expect(loadPreset(memStore())).toBe('indigo-light')
    expect(loadPreset(memStore({ [THEME_KEY]: 'spectrum' }))).toBe('spectrum')
    expect(loadPreset(memStore({ [THEME_KEY]: 'solarized-light' }))).toBe('solarized-light')
  })

  it('migrates the legacy light/dark/system prefs and rejects nonsense', () => {
    expect(loadPreset(memStore({ [THEME_KEY]: 'light' }))).toBe('indigo-light')
    expect(loadPreset(memStore({ [THEME_KEY]: 'dark' }))).toBe('indigo-dark')
    // 'system' resolves via matchMedia (undefined in node) → light default.
    expect(loadPreset(memStore({ [THEME_KEY]: 'system' }))).toBe('indigo-light')
    expect(loadPreset(memStore({ [THEME_KEY]: 'nonsense' }))).toBe('indigo-light')
  })

  it('round-trips via save', () => {
    const store = memStore()
    savePreset('octagon', store)
    expect(loadPreset(store)).toBe('octagon')
    savePreset('quiet-light', store)
    expect(loadPreset(store)).toBe('quiet-light')
  })

  it('nextPreset walks the cycle in order and wraps', () => {
    const order = PRESETS.map((p) => p.id)
    order.forEach((id, i) => {
      expect(nextPreset(id)).toBe(order[(i + 1) % order.length])
    })
    // Wrap: last → first.
    expect(nextPreset(order[order.length - 1]!)).toBe(order[0])
  })

  it('modeOf reports each preset mode; presetById falls back to the default', () => {
    expect(modeOf('indigo-light')).toBe('light')
    expect(modeOf('octagon')).toBe('dark')
    expect(presetById('spectrum').id).toBe('spectrum')
    expect(presetById('who-knows' as PresetId).id).toBe(DEFAULT_PRESET)
    expect(presetById(null).id).toBe(DEFAULT_PRESET)
  })
})
