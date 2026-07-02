import { describe, it, expect } from 'vitest'
import { buildRoundsSegments, buildCycleSegments } from './segments'

describe('buildRoundsSegments', () => {
  it('returns an empty list when rounds is zero or negative', () => {
    expect(buildRoundsSegments({ work: 20, rest: 10, rounds: 0 })).toEqual([])
    expect(buildRoundsSegments({ work: 20, rest: 10, rounds: -3 })).toEqual([])
  })

  it('produces the Tabata shape from Rounds defaults (20/10 x 8, no trailing rest)', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 8 })
    expect(segments).toHaveLength(15) // 8 work + 7 rest
    expect(segments[0]).toMatchObject({ label: 'Work', seconds: 20, kind: 'work' })
    expect(segments[1]).toMatchObject({ label: 'Rest', seconds: 10, kind: 'rest' })
    expect(segments.at(-1)).toMatchObject({ label: 'Work', seconds: 20, kind: 'work' })
  })

  it('adds a prepare-kind warmup segment first when warmup > 0', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 2, warmup: 30 })
    expect(segments[0]).toMatchObject({ label: 'Warmup', seconds: 30, kind: 'prepare' })
    expect(segments).toHaveLength(4) // warmup + 2 work + 1 rest
  })

  it('omits warmup entirely when not provided', () => {
    const segments = buildRoundsSegments({ work: 20, rest: 10, rounds: 2 })
    expect(segments.some((s) => s.kind === 'prepare')).toBe(false)
  })

  it('adds a trailing rest after the final round only when restAfterLast is true', () => {
    const withTrailing = buildRoundsSegments({ work: 20, rest: 10, rounds: 3, restAfterLast: true })
    expect(withTrailing).toHaveLength(6) // 3 work + 3 rest
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
    expect(segments.at(-1).kind).toBe('work')
  })

  it('substitutes a long break every cyclesBeforeLongBreak-th break', () => {
    const segments = buildCycleSegments({
      focus: 25,
      shortBreak: 5,
      longBreak: 15,
      cyclesBeforeLongBreak: 2,
      totalCycles: 4,
    })
    // Focus, Break, Focus, Long break, Focus, Break, Focus
    const labels = segments.map((s) => s.label)
    expect(labels).toEqual(['Focus', 'Break', 'Focus', 'Long break', 'Focus', 'Break', 'Focus'])
    expect(segments[3].seconds).toBe(15)
  })
})
