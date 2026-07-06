import { describe, it, expect } from 'vitest'
import {
  easeInOutSine,
  exhaleDuration,
  cyclePhases,
  scaleFor,
  EXHALE_START,
  EXHALE_END,
} from './breath'

describe('easeInOutSine', () => {
  it('pins the ends and clamps out-of-range input', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0)
    expect(easeInOutSine(1)).toBeCloseTo(1)
    expect(easeInOutSine(-1)).toBeCloseTo(0)
    expect(easeInOutSine(2)).toBeCloseTo(1)
  })
  it('is symmetric about the midpoint', () => {
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5)
    expect(easeInOutSine(0.25) + easeInOutSine(0.75)).toBeCloseTo(1)
  })
})

describe('exhaleDuration', () => {
  it('grows from the start length to the end length across the session', () => {
    expect(exhaleDuration(0, 900)).toBeCloseTo(EXHALE_START)
    expect(exhaleDuration(900, 900)).toBeCloseTo(EXHALE_END)
    expect(exhaleDuration(450, 900)).toBeCloseTo((EXHALE_START + EXHALE_END) / 2)
  })
  it('clamps past the end and guards a zero-length session', () => {
    expect(exhaleDuration(1800, 900)).toBeCloseTo(EXHALE_END)
    expect(exhaleDuration(10, 0)).toBeCloseTo(EXHALE_START)
  })
})

describe('cyclePhases', () => {
  it('478 is a fixed inhale-hold-exhale', () => {
    const phases = cyclePhases('478', 0, 900)
    expect(phases.map((p) => p.phase)).toEqual(['inhale', 'hold', 'exhale'])
    expect(phases.map((p) => p.dur)).toEqual([4, 7, 8])
  })
  it('exhale mode has no hold and its exhale lengthens over the session', () => {
    const early = cyclePhases('exhale', 0, 900)
    const late = cyclePhases('exhale', 900, 900)
    expect(early.map((p) => p.phase)).toEqual(['inhale', 'exhale'])
    expect(late[1].dur).toBeGreaterThan(early[1].dur)
  })
})

describe('scaleFor', () => {
  it('inhale rises 0→1, exhale falls 1→0, hold stays put', () => {
    const [inhale, hold, exhale] = cyclePhases('478', 0, 900)
    expect(scaleFor(inhale, 0)).toBeCloseTo(0)
    expect(scaleFor(inhale, 1)).toBeCloseTo(1)
    expect(scaleFor(hold, 0.5)).toBeCloseTo(1)
    expect(scaleFor(exhale, 0)).toBeCloseTo(1)
    expect(scaleFor(exhale, 1)).toBeCloseTo(0)
  })
})
