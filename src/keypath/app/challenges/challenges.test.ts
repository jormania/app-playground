import { describe, expect, it } from 'vitest'
import { memoryStore } from '../store'
import { NoteRace, RACE_NOTES } from './noteRace'
import { RecordRepo } from './records'
import { beatMs, ECHO_PATTERNS, ECHO_WINDOW_MS, judgeEcho, turnTimeline } from './rhythm'

/** A fixed sequence of "random" numbers. */
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('NoteRace', () => {
  it('counts keys with the asked name, in any octave, and moves on to a different note', () => {
    const race = new NoteRace(1, seq(0, 0.5, 0.99))
    expect(race.prompt).toBe(0) // C
    expect(race.press(60, 0)).toBeNull() // not started
    race.start(1000)
    expect(race.press(62, 1100)).toBe('wrong')
    expect(race.press(48, 1200)).toBe('right') // a low C counts
    expect(race.prompt).not.toBe(0)
    expect(race).toMatchObject({ score: 1, wrong: 1 })
  })

  it('stops counting when the clock runs out', () => {
    const race = new NoteRace(1, seq(0))
    race.start(0)
    expect(race.remaining(10_000)).toBe(20_000)
    expect(race.finished(30_000)).toBe(true)
    expect(race.press(60, 30_001)).toBeNull()
  })

  it('never asks for the same note twice in a row, and only notes of its level', () => {
    const race = new NoteRace(2, Math.random)
    race.start(0)
    let last = race.prompt
    for (let i = 0; i < 200; i++) {
      expect(RACE_NOTES[2]).toContain(race.prompt)
      race.press(60 + race.prompt, 1)
      expect(race.prompt).not.toBe(last)
      last = race.prompt
    }
  })
})

describe('Rhythm echo', () => {
  const bpm = 60 // one beat = 1000 ms, easy to read

  it('lays out a turn: four clicks, the pattern, four clicks, then her bar', () => {
    const t = turnTimeline([0, 1.5, 3], bpm, 10_000)
    expect(t.listenClicks.map((c) => c.at)).toEqual([10_000, 11_000, 12_000, 13_000])
    expect(t.listenClicks.map((c) => c.accent)).toEqual([true, false, false, false])
    expect(t.notes).toEqual([14_000, 15_500, 17_000])
    expect(t.yourClicks[0].at).toBe(18_000)
    expect(t.downbeat).toBe(22_000)
    expect(t.end).toBe(26_000)
  })

  it('matches each note to the nearest tap within the window and says early, late or on time', () => {
    const r = judgeEcho([0, 1, 2, 3], bpm, 0, [10, 1090, 1950, 3300], 'relaxed')
    expect(r.marks.map((m) => m.verdict)).toEqual(['onTime', 'late', 'onTime', 'missed'])
    expect(r.marks[1].deltaMs).toBe(90)
    expect(r.extra).toBe(1) // the tap at 3300 was too late to be the fourth note
    expect(r.passed).toBe(false)
  })

  it('passes a clean echo, forgives one stray tap, not two', () => {
    const clean = [0, 1000, 2000]
    expect(judgeEcho([0, 1, 2], bpm, 0, clean, 'normal').passed).toBe(true)
    expect(judgeEcho([0, 1, 2], bpm, 0, [...clean, 2500], 'normal').passed).toBe(true)
    expect(judgeEcho([0, 1, 2], bpm, 0, [...clean, 2500, 3500], 'normal').passed).toBe(false)
  })

  it('tightens the window with the Timing setting', () => {
    const late = ECHO_WINDOW_MS.strict + 10
    expect(judgeEcho([0], bpm, 0, [late], 'relaxed').passed).toBe(true)
    expect(judgeEcho([0], bpm, 0, [late], 'strict').passed).toBe(false)
  })

  it('has five patterns a level, each inside one 4/4 bar, in time order', () => {
    for (const patterns of Object.values(ECHO_PATTERNS)) {
      expect(patterns).toHaveLength(5)
      for (const p of patterns) {
        expect([...p].sort((a, b) => a - b)).toEqual(p)
        expect(Math.min(...p)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...p)).toBeLessThan(4)
      }
    }
    expect(beatMs(120)).toBe(500)
  })
})

describe('RecordRepo', () => {
  it('keeps each level’s best, per player, and says when it’s new', async () => {
    const repo = new RecordRepo(memoryStore())
    expect(await repo.offer('nora', 'race', 1, 12)).toBe(true)
    expect(await repo.offer('nora', 'race', 1, 9)).toBe(false)
    expect(await repo.offer('nora', 'race', 1, 14)).toBe(true)
    expect(await repo.offer('nora', 'echo', 2, 0)).toBe(false) // a zero is never a “best”
    expect(await repo.get('nora')).toEqual({ race: { 1: 14 }, echo: { 2: 0 } })
    expect(await repo.get('gabriel')).toEqual({ race: {}, echo: {} })
  })
})
