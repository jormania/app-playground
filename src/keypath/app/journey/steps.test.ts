import { describe, expect, it } from 'vitest'
import { Tune } from './exercises'
import { fingeringProblems } from '../../engine/testing/fingering'
import { staffStep } from './Staff'
import { CHORD_WINDOW_MS, JOURNEY, stepById } from './steps'

/** Play an exercise through by its lit keys (every practice lights its answer). */
function playLit(ex: ReturnType<(typeof JOURNEY)[number]['practice']>) {
  let t = 0
  for (let guard = 0; !ex.finished && guard < 200; guard++) {
    const keys = ex.view().targets
    expect(keys.length, 'a practice always shows the next key').toBeGreaterThan(0)
    for (const k of keys) ex.press(k, t)
    for (const k of keys) ex.release(k)
    t += 1000
  }
  return ex
}

describe('the Journey steps', () => {
  it('are the six from the design, the three added before Nora’s first look, and finger numbers second', () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(['middleC', 'fingers', 'cde', 'fiveFinger', 'chord', 'twoHands', 'notation', 'leftHand', 'blackKeys', 'readingHigher'])
  })

  it('every practice can be played through by its lit keys, with nothing wrong', () => {
    for (const s of JOURNEY) {
      const ex = playLit(s.practice('relaxed'))
      expect(ex.finished, s.id).toBe(true)
      expect(ex.wrong, s.id).toBe(0)
    }
  })

  it('lights only keys drawn on that step’s keyboard, and its tunes fit it too', () => {
    for (const s of JOURNEY) {
      for (const ex of [s.practice('relaxed'), s.check('relaxed')]) {
        const pitches = ex instanceof Tune ? ex.notes.map((n) => n.pitch) : ex.view().targets
        for (const p of pitches) {
          expect(p, s.id).toBeGreaterThanOrEqual(s.range.low)
          expect(p, s.id).toBeLessThanOrEqual(s.range.high)
        }
      }
    }
  })

  it('hides every key in a check', () => {
    for (const s of JOURNEY) expect(s.check('relaxed').view().targets, s.id).toEqual([])
  })

  it('only the tune steps, and finger numbers (which need the exact octave), ask for middle C first', () => {
    expect(JOURNEY.filter((s) => s.octaveGate).map((s) => s.id)).toEqual(['fingers', 'fiveFinger', 'twoHands', 'notation', 'leftHand', 'readingHigher'])
  })

  it('the staff draws exactly the notes the reading steps judge', () => {
    for (const s of JOURNEY.filter((x) => x.staff)) {
      for (const [staff, ex] of [
        [s.staff!.practice, s.practice('relaxed')],
        [s.staff!.check, s.check('relaxed')],
      ] as const) {
        expect((ex as Tune).notes.map((n) => n.pitch), s.id).toEqual(staff.map(([p]) => p))
        staff.forEach(([p]) => expect(() => staffStep(p)).not.toThrow())
      }
    }
  })

  it('finger numbers mirror: each hand counts from its thumb, in the C position', () => {
    const ask = (ex: ReturnType<(typeof JOURNEY)[number]['check']>) => ex.view().finger
    const ex = stepById('fingers')!.check('relaxed')
    const key = { right: { 1: 60, 2: 62, 3: 64, 4: 65, 5: 67 }, left: { 5: 48, 4: 50, 3: 52, 2: 53, 1: 55 } } as const
    for (let guard = 0; !ex.finished && guard < 20; guard++) {
      const f = ask(ex)!
      const right = key[f.hand][f.finger]
      // The same note an octave off is the wrong finger in this position.
      expect(ex.press(right + 12, 0)).toBe('wrong')
      expect(ex.press(right, 0)).toBe('right')
    }
    expect(ex.finished).toBe(true)
    // The practice asks every finger of both hands.
    const practice = stepById('fingers')!.practice('relaxed')
    const asked = new Set<string>()
    while (!practice.finished) {
      const f = practice.view().finger!
      asked.add(`${f.hand}${f.finger}`)
      practice.press(practice.view().targets[0], 0)
    }
    expect(asked.size).toBe(10)
  })

  it('every tune has a finger on every note, and the fingering holds together', () => {
    for (const s of JOURNEY) {
      for (const ex of [s.practice('relaxed'), s.check('relaxed')]) {
        if (!(ex instanceof Tune)) continue
        expect(ex.notes.every((n) => n.finger), s.id).toBe(true)
        const song = { id: s.id, title: '', notes: ex.notes, bpm: 80, beatsPerBar: 4, durationMs: 0 }
        expect(fingeringProblems(song), s.id).toEqual([])
      }
    }
  })

  it('the chord step takes its window from the player’s Timing setting', () => {
    const step = stepById('chord')!
    const loose = step.check('relaxed')
    loose.press(60, 0)
    loose.press(64, 0)
    expect(loose.press(67, CHORD_WINDOW_MS.relaxed)).toBe('right')
    const tight = step.check('strict')
    tight.press(60, 0)
    tight.press(64, 0)
    expect(tight.press(67, CHORD_WINDOW_MS.relaxed)).toBe('spread')
  })
})

describe('staffStep', () => {
  it('counts white keys from middle C', () => {
    expect([60, 62, 64, 65, 67, 72].map(staffStep)).toEqual([0, 1, 2, 3, 4, 7])
    expect(() => staffStep(61)).toThrow()
  })
})
