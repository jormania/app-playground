import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MIX,
  SCENE_PRESETS,
  PRESET_ORDER,
  PRESET_APPLY_KEYS,
  LAYER_KEYS,
  activePreset,
} from './mix.js'
import { taper, resolveMix } from './ambientAudio.js'

describe('mix model integrity', () => {
  it('every preset defines exactly the apply keys — no missing, no leftover', () => {
    // guards against a fat-fingered preset, or a removed key (drone/city) lingering
    for (const key of PRESET_ORDER) {
      expect(Object.keys(SCENE_PRESETS[key]).sort()).toEqual([...PRESET_APPLY_KEYS].sort())
    }
  })

  it('presets never set the master volume (it stays a personal comfort dial)', () => {
    for (const key of PRESET_ORDER) expect(SCENE_PRESETS[key]).not.toHaveProperty('volume')
  })

  it('every preset value is an integer in 0..10', () => {
    for (const key of PRESET_ORDER) {
      for (const v of Object.values(SCENE_PRESETS[key])) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(10)
      }
    }
  })

  it('the layers are a subset of the apply keys', () => {
    for (const k of LAYER_KEYS) expect(PRESET_APPLY_KEYS).toContain(k)
  })

  it('drone and city are fully gone from the model', () => {
    expect(LAYER_KEYS).not.toContain('drone')
    expect(PRESET_APPLY_KEYS).not.toContain('drone')
    expect(PRESET_APPLY_KEYS).not.toContain('city')
  })

  it('DEFAULT_MIX is the Forest scene at volume 8', () => {
    expect(DEFAULT_MIX.volume).toBe(8)
    for (const k of PRESET_APPLY_KEYS) expect(DEFAULT_MIX[k]).toBe(SCENE_PRESETS.forest[k])
  })
})

describe('activePreset', () => {
  it('highlights Forest for the default mix', () => {
    expect(activePreset(DEFAULT_MIX)).toBe('forest')
  })

  it('matches each preset when applied over the default', () => {
    for (const key of PRESET_ORDER) {
      expect(activePreset({ ...DEFAULT_MIX, ...SCENE_PRESETS[key] })).toBe(key)
    }
  })

  it('clears once any character slider is tweaked', () => {
    expect(activePreset({ ...DEFAULT_MIX, leaves: DEFAULT_MIX.leaves + 1 })).toBeNull()
  })

  it('ignores the master volume (not a scene key)', () => {
    expect(activePreset({ ...DEFAULT_MIX, volume: 1 })).toBe('forest')
  })

  it('is null-safe', () => {
    expect(activePreset(null)).toBeNull()
  })
})

describe('taper', () => {
  it('pins 0 to true silence and 1 to unity', () => {
    expect(taper(0, 1.9)).toBe(0)
    expect(taper(1, 1.9)).toBe(1)
  })

  it('is monotonically non-decreasing', () => {
    let prev = -1
    for (let t = 0; t <= 1.00001; t += 0.05) {
      const v = taper(t, 1.4)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('clamps out-of-range input', () => {
    expect(taper(-1, 1.9)).toBe(0)
    expect(taper(2, 1.9)).toBe(1)
  })
})

describe('resolveMix', () => {
  it('volume 0 is true silence', () => {
    expect(resolveMix({ volume: 0 }).master).toBe(0)
  })

  it('the default volume 8 gives the tuned master ceiling', () => {
    expect(resolveMix({ volume: 8 }).master).toBeCloseTo(Math.pow(0.8, 1.9) * 0.24, 6)
  })

  it('maps brightness to a log-frequency low-pass', () => {
    expect(resolveMix({ brightness: 8 }).toneHz).toBeCloseTo(520 * Math.pow(8200 / 520, 0.8), 3)
  })

  it('resolves the two voice groups and omits the removed ones', () => {
    const p = resolveMix({ wildlife: 5, omens: 3 })
    expect(p.wildlife).toBeCloseTo(Math.pow(0.5, 1.4), 6)
    expect(p.omens).toBeCloseTo(Math.pow(0.3, 1.4), 6)
    expect(p.city).toBeUndefined()
    expect(p.drone).toBeUndefined()
  })

  it('activity is a frequency multiplier centred above zero', () => {
    expect(resolveMix({ activity: 0 }).activity).toBeCloseTo(0.4, 6)
    expect(resolveMix({ activity: 10 }).activity).toBeCloseTo(1.8, 6)
  })

  it('ignores unknown keys and tolerates missing input', () => {
    expect(() => resolveMix(null)).not.toThrow()
    expect(resolveMix(null).master).toBe(0)
    expect(resolveMix({ nonsense: 99 }).rain).toBe(0)
  })
})
