// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_OUTPUT, gainFor, loadOutputLevel, saveOutputLevel, toggled, withLevel } from './outputLevel'

beforeEach(() => localStorage.clear())

describe('keyboard output level', () => {
  it('starts at 0, so nothing reaches the keyboard until chosen', () => {
    expect(loadOutputLevel()).toEqual(DEFAULT_OUTPUT)
    expect(DEFAULT_OUTPUT.level).toBe(0)
    expect(gainFor(0)).toBe(0)
  })

  it('toggles back to the last level used', () => {
    const on = withLevel(DEFAULT_OUTPUT, 70)
    const off = toggled(on)
    expect(off.level).toBe(0)
    expect(toggled(off).level).toBe(70)
  })

  it('toggling on from a fresh start uses a sensible middle level', () => {
    expect(toggled(DEFAULT_OUTPUT).level).toBe(50)
  })

  it('clamps and persists', () => {
    saveOutputLevel(withLevel(DEFAULT_OUTPUT, 250))
    expect(loadOutputLevel()).toEqual({ level: 100, lastLevel: 100 })
  })

  it('maps the slider to a squared gain', () => {
    expect(gainFor(50)).toBeCloseTo(0.25)
    expect(gainFor(100)).toBe(1)
  })
})
