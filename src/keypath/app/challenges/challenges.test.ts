import { describe, expect, it } from 'vitest'
import { K, memoryStore } from '../store'
import { CHORDS, ChordCatch, pitchClassesOf, SCREEN_KEYS, shows, voicingOf } from './chordCatch'
import { NoteRace, RACE_NOTES, STAFF_NOTES } from './noteRace'
import { RecordRepo } from './records'
import { beatMs, ECHO_PATTERNS, ECHO_WINDOW_MS, judgeEcho, syllables, turnTimeline } from './rhythm'

/** A fixed sequence of "random" numbers. */
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('NoteRace', () => {
  it('counts keys with the asked name, in any octave, and moves on to a different note', () => {
    const race = new NoteRace(1, seq(0, 0.5, 0.99))
    expect(race.prompt).toBe(60) // C, shown as middle C
    expect(race.press(60, 0)).toBeNull() // not started
    race.start(1000)
    expect(race.press(62, 1100)).toBe('wrong')
    expect(race.press(48, 1200)).toBe('right') // a low C counts
    expect(race.prompt % 12).not.toBe(0)
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
      expect(RACE_NOTES[2]).toContain(race.prompt % 12)
      race.press(race.prompt - 12, 1)
      expect(race.prompt % 12).not.toBe(last % 12)
      last = race.prompt
    }
  })
})

describe('NoteRace, read-it mode', () => {
  it('shows white keys on the staff, rising by level, and still takes any octave', () => {
    const race = new NoteRace(3, seq(0.99), 30_000, 'staff')
    expect(race.prompt).toBe(STAFF_NOTES[3].at(-1)) // G5, above the staff
    race.start(0)
    expect(race.press(55, 1)).toBe('right') // G3 counts
    for (let i = 0; i < 50; i++) {
      expect(STAFF_NOTES[3]).toContain(race.prompt)
      race.press(race.prompt, 2)
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
    expect(await repo.offer('nora', 'staff', 1, 6)).toBe(true) // the race on the staff keeps its own
    expect(await repo.offer('nora', 'chord', 3, 4)).toBe(true)
    expect(await repo.get('nora')).toEqual({ race: { 1: 14 }, staff: { 1: 6 }, echo: { 2: 0 }, chord: { 3: 4 } })
    expect(await repo.get('gabriel')).toEqual({ race: {}, staff: {}, echo: {}, chord: {} })
  })

  it('reads records saved before the staff and chord games existed', async () => {
    const store = memoryStore()
    await store.set(K.challenges('nora'), { race: { 2: 9 }, echo: {} })
    const repo = new RecordRepo(store)
    expect(await repo.get('nora')).toEqual({ race: { 2: 9 }, staff: {}, echo: {}, chord: {} })
    expect(await repo.offer('nora', 'chord', 1, 3)).toBe(true)
    expect((await repo.get('nora')).race[2]).toBe(9)
  })
})

describe('ChordCatch', () => {
  it('spells each chord by name, and lights it from middle C', () => {
    const byId = Object.fromEntries(CHORDS[3].map((c) => [c.id, c]))
    expect(pitchClassesOf(byId.C)).toEqual([0, 4, 7])
    expect(pitchClassesOf(byId.Am)).toEqual([9, 0, 4])
    expect(pitchClassesOf(byId.D)).toEqual([2, 6, 9]) // F♯: the black key level 3 is for
    expect(voicingOf(byId.C)).toEqual([60, 64, 67])
    expect(voicingOf(byId.G)).toEqual([55, 59, 62]) // from middle C it would run off the screen keys
    for (const c of CHORDS[3]) {
      const v = voicingOf(c)
      expect(v.map((p) => ((p % 12) + 12) % 12)).toEqual(pitchClassesOf(c))
      expect(Math.min(...v)).toBeGreaterThanOrEqual(SCREEN_KEYS.low)
      expect(Math.max(...v)).toBeLessThanOrEqual(SCREEN_KEYS.high)
    }
    expect(CHORDS[1].map((c) => c.id)).toEqual(['C', 'F', 'G'])
    expect(CHORDS[2]).toHaveLength(6)
    expect([shows(1), shows(2), shows(3)]).toEqual([true, true, false])
  })

  it('counts a chord played together, and asks the next one only once the hand is off', () => {
    const g = new ChordCatch(1, 'relaxed', seq(0, 0.99)) // C, then G
    expect(g.prompt.id).toBe('C')
    g.start(0)
    expect(g.press(48, 1000)).toBeNull() // any octave, any order
    expect(g.press(55, 1040)).toBeNull()
    expect(g.press(64, 1100)).toBe('right')
    expect(g.score).toBe(1)
    expect(g.caught).toBe(true)
    g.release(48)
    g.release(55)
    expect(g.prompt.id).toBe('C') // one key still down
    g.release(64)
    expect(g.caught).toBe(false)
    expect(g.prompt.id).toBe('G') // never the same chord twice
  })

  it('tells spread-out keys and wrong keys apart', () => {
    const g = new ChordCatch(1, 'strict', seq(0))
    g.start(0)
    g.press(60, 100)
    g.press(64, 150)
    expect(g.press(67, 300)).toBe('spread') // 200 ms: more than strict's 70
    for (const p of [60, 64, 67]) g.release(p)
    expect(g.press(61, 400)).toBe('wrong')
    g.release(61)
    expect(g.press(60, 500)).toBeNull()
    expect(g.press(64, 510)).toBeNull()
    expect(g.press(67, 520)).toBe('right')
    expect([g.score, g.spread, g.wrong]).toEqual([1, 1, 1])
    expect(g.press(60, 45_000)).toBeNull() // time’s up
  })
})

describe('rhythm syllables', () => {
  it('ta for a beat, ti ti for two halves, ti off the beat', () => {
    expect(syllables([0, 1, 2, 3])).toEqual(['ta', 'ta', 'ta', 'ta'])
    expect(syllables([0, 1, 1.5, 2, 3])).toEqual(['ta', 'ti', 'ti', 'ta', 'ta'])
    expect(syllables([0.5, 1, 2, 3])).toEqual(['ti', 'ta', 'ta', 'ta'])
    // A rest after a note doesn't make it a ti.
    expect(syllables([0, 2])).toEqual(['ta', 'ta'])
    for (const p of Object.values(ECHO_PATTERNS).flat()) expect(syllables(p)).toHaveLength(p.length)
  })
})
