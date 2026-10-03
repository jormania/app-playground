import { describe, expect, it } from 'vitest'
import { stepsOf } from '../../engine'
import { LEVELS, levelPitches, pieceFor, READ_BEAT_MS, type ReadLevel } from './readPlay'

/** A seeded random, so a failure can be replayed. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31
  return seed / 2 ** 31
}

describe('Read and play pieces', () => {
  it('fill each bar exactly, stay in their position, move within reach and end at home', () => {
    for (const level of [1, 2, 3] as ReadLevel[]) {
      const spec = LEVELS[level]
      for (let s = 1; s <= 200; s++) {
        const { song, practice } = pieceFor(level, seeded(s))
        expect(practice).toBe(spec.practice)
        const right = song.notes.filter((n) => n.hand === 'right')
        // Four beats a bar, bar after bar.
        for (let b = 0; b < spec.bars; b++) {
          const beats = right.filter((n) => n.bar === b).reduce((sum, n) => sum + n.durationMs / 0.95 / READ_BEAT_MS, 0)
          expect(beats).toBeCloseTo(4)
        }
        // G is in both positions: the one the piece is in holds every note, and ends on its own thumb.
        const position = spec.positions.find((p) => right.every((n) => p.right.includes(n.pitch as never)) && p.right[0] === right.at(-1)!.pitch)!
        expect(position).toBeTruthy()
        const places = right.map((n) => position.right.indexOf(n.pitch as never))
        for (let i = 1; i < places.length; i++) expect(Math.abs(places[i] - places[i - 1])).toBeLessThanOrEqual(spec.reach)
        expect(places.at(-1)).toBe(0)
        // Fingers follow the position: the thumb on its first key.
        expect(right.every((n) => n.finger === position.right.indexOf(n.pitch as never) + 1)).toBe(true)
        const left = song.notes.filter((n) => n.hand === 'left')
        if (practice === 'both') {
          expect(left.map((n) => n.bar)).toEqual([...Array(spec.bars).keys()])
          expect(left.at(-1)?.pitch).toBe(position.bass[0])
        } else expect(left).toEqual([])
        expect(song.notes.every((n) => levelPitches(level).includes(n.pitch))).toBe(true)
      }
    }
  })

  it('level 1 goes step by step in quarter notes, its last note held', () => {
    const { song } = pieceFor(1, seeded(7))
    expect(song.notes.map((n) => Math.round(n.durationMs / 0.95))).toEqual([1000, 1000, 1000, 1000, 1000, 1000, 2000])
    expect(song.notes.every((n) => n.pitch >= 60 && n.pitch <= 67)).toBe(true)
  })

  it('is different each time, and a piece the judge can wait through step by step', () => {
    const tunes = new Set(Array.from({ length: 20 }, (_, i) => pieceFor(2, seeded(i + 1)).song.notes.map((n) => n.pitch).join(',')))
    expect(tunes.size).toBeGreaterThan(10)
    const { song } = pieceFor(3, seeded(3))
    expect(stepsOf(song.notes).length).toBeGreaterThan(8)
  })
})
