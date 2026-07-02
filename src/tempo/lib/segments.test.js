import { describe, it, expect } from 'vitest'
import {
  buildRoundsSegments,
  buildCycleSegments,
  buildSitWalkSegments,
  build478Segments,
  buildBoxSegments,
} from './segments'

describe('buildRoundsSegments', () => {
  it('returns an empty list when rounds is zero or negative', () => {
    expect(buildRoundsSegments({ work: 20, rest: 10, rounds: 0 })).toEqual([])
    expect(buildRoundsSegments({ work: 20, rest: 10, rounds: -3 })).toEqual([])
  })

  it('produces the Tabata shape from Rounds defaults (20/10 x 8, no trailing rest)', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 8 })
    expect(segments).toHaveLength(15) // 8 move + 7 rest
    expect(segments[0]).toMatchObject({ label: 'Move', seconds: 20, kind: 'active' })
    expect(segments[1]).toMatchObject({ label: 'Rest', seconds: 10, kind: 'rest' })
    expect(segments.at(-1)).toMatchObject({ label: 'Move', seconds: 20, kind: 'active' })
  })

  it('adds a prepare-kind warm-up segment first when warmup > 0', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 2, warmup: 30 })
    expect(segments[0]).toMatchObject({ label: 'Warm-up', seconds: 30, kind: 'prepare' })
    expect(segments).toHaveLength(4) // warm-up + 2 move + 1 rest
  })

  it('omits warm-up entirely when not provided', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 2 })
    expect(segments.some((s) => s.kind === 'prepare')).toBe(false)
  })

  it('adds a trailing rest after the final round only when restAfterLast is true', () => {
    const withTrailing = buildRoundsSegments({ work: 20, rest: 10, rounds: 3, restAfterLast: true })
    expect(withTrailing).toHaveLength(6) // 3 move + 3 rest
    expect(withTrailing.at(-1)).toMatchObject({ label: 'Rest', kind: 'rest' })
  })
})

describe('buildCycleSegments', () => {
  it('returns an empty list when totalCycles is zero or negative', () => {
    expect(
      buildCycleSegments({ focus: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLongBreak: 4, totalCycles: 0 }),
    ).toEqual([])
  })

  it('alternates focus/break and never appends a break after the last focus segment', () => {
    const segments = buildCycleSegments({
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
      cyclesBeforeLongBreak: 4,
      totalCycles: 2,
    })
    expect(segments).toHaveLength(3) // focus, break, focus
    expect(segments.map((s) => s.label)).toEqual(['Focus', 'Break', 'Focus'])
    expect(segments.at(-1).kind).toBe('focus')
  })

  it('substitutes a long break every cyclesBeforeLongBreak-th break', () => {
    const segments = buildCycleSegments({
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
      cyclesBeforeLongBreak: 2,
      totalCycles: 4,
    })
    const labels = segments.map((s) => s.label)
    expect(labels).toEqual(['Focus', 'Break', 'Focus', 'Long break', 'Focus', 'Break', 'Focus'])
    expect(segments[3].seconds).toBe(15)
  })
})

describe('buildSitWalkSegments', () => {
  it('returns an empty list when sits is zero or negative', () => {
    expect(buildSitWalkSegments({ sit: 1200, walk: 300, sits: 0 })).toEqual([])
  })

  it('places a walk between seated blocks but never after the last sit', () => {
    // The classic 45-minute shape: 20 sit / 5 walk / 20 sit.
    const segments = buildSitWalkSegments({ sit: 1200, walk: 300, sits: 2 })
    expect(segments.map((s) => s.label)).toEqual(['Sit', 'Walk', 'Sit'])
    expect(segments[0]).toMatchObject({ seconds: 1200, kind: 'sit' })
    expect(segments[1]).toMatchObject({ seconds: 300, kind: 'walk' })
    expect(segments.at(-1).kind).toBe('sit')
  })

  it('scales to more seated blocks with walks interleaved', () => {
    const segments = buildSitWalkSegments({ sit: 600, walk: 180, sits: 3 })
    expect(segments.map((s) => s.label)).toEqual(['Sit', 'Walk', 'Sit', 'Walk', 'Sit'])
  })
})

describe('build478Segments', () => {
  it('repeats the fixed 4-7-8 protocol for the given number of cycles', () => {
    const segments = build478Segments({ cycles: 2 })
    expect(segments).toHaveLength(6)
    expect(segments.slice(0, 3)).toMatchObject([
      { label: 'Inhale', seconds: 4, kind: 'inhale' },
      { label: 'Hold', seconds: 7, kind: 'hold' },
      { label: 'Exhale', seconds: 8, kind: 'exhale' },
    ])
  })

  it('returns an empty list for zero cycles', () => {
    expect(build478Segments({ cycles: 0 })).toEqual([])
  })
})

describe('buildBoxSegments', () => {
  it('generates four equal segments per cycle (inhale/hold/exhale/hold)', () => {
    const segments = buildBoxSegments({ side: 4, cycles: 2 })
    expect(segments).toHaveLength(8)
    expect(segments.slice(0, 4)).toMatchObject([
      { label: 'Inhale', seconds: 4, kind: 'inhale' },
      { label: 'Hold', seconds: 4, kind: 'hold' },
      { label: 'Exhale', seconds: 4, kind: 'exhale' },
      { label: 'Hold', seconds: 4, kind: 'hold' },
    ])
  })

  it('honours a custom side length', () => {
    const segments = buildBoxSegments({ side: 6, cycles: 1 })
    expect(segments.every((s) => s.seconds === 6)).toBe(true)
  })
})
