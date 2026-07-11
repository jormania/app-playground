import { describe, it, expect } from 'vitest'
import { DEFAULT_MIX, SCENE_PRESETS, MIX_MAX } from './storage'
import { taper, resolveMix } from './soundscape'

// Yoru's eight blendable layers (it keeps `drone`, unlike Touch Grass).
const LAYER_KEYS = ['rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth', 'drone']
const SHAPERS = ['volume', 'brightness', 'motion', 'pace']

describe('scene presets', () => {
  it('every preset defines exactly the eight layers', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      expect(Object.keys(SCENE_PRESETS[key]).sort()).toEqual([...LAYER_KEYS].sort())
    }
  })

  it('presets leave the shapers alone (so a scene pick keeps your volume/tone)', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      for (const s of SHAPERS) expect(SCENE_PRESETS[key]).not.toHaveProperty(s)
    }
  })

  it('every preset value is an integer in 0..MIX_MAX', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      for (const v of Object.values(SCENE_PRESETS[key])) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(MIX_MAX)
      }
    }
  })

  it('DEFAULT_MIX carries all eight layers plus the four shapers', () => {
    for (const k of LAYER_KEYS) expect(DEFAULT_MIX).toHaveProperty(k)
    for (const s of SHAPERS) expect(DEFAULT_MIX).toHaveProperty(s)
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

  it('resolves each layer through the gentler taper', () => {
    expect(resolveMix({ rain: 6 }).rain).toBeCloseTo(Math.pow(0.6, 1.4), 6)
    expect(resolveMix({ drone: 3 }).drone).toBeCloseTo(Math.pow(0.3, 1.4), 6)
  })

  it('tolerates missing input and ignores unknown keys', () => {
    expect(() => resolveMix(null)).not.toThrow()
    expect(resolveMix(null).master).toBe(0)
    expect(resolveMix({ nonsense: 99 }).rain).toBe(0)
  })
})
