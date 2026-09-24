import { describe, expect, it } from 'vitest'
import { Tune } from './exercises'
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
  it('are the six from the design, then the three added before Nora’s first look, in order', () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(['middleC', 'cde', 'fiveFinger', 'chord', 'twoHands', 'notation', 'leftHand', 'blackKeys', 'readingHigher'])
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

  it('only the tune steps ask for middle C first', () => {
    expect(JOURNEY.filter((s) => s.octaveGate).map((s) => s.id)).toEqual(['fiveFinger', 'twoHands', 'notation', 'leftHand', 'readingHigher'])
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
