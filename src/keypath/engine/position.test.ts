import { describe, expect, it } from 'vitest'
import { handPlaces } from './position'
import type { Finger, Hand, SongNote } from './song'

let id = 0
const n = (pitch: number, startMs: number, hand: Hand, finger?: Finger): SongNote => ({ id: id++, pitch, startMs, durationMs: 400, hand, bar: 0, ...(finger ? { finger } : {}) })

describe('handPlaces', () => {
  it('finds a thumb from the finger numbers: finger 3 on G is a thumb on E', () => {
    const notes = [n(67, 0, 'right', 3), n(69, 500, 'right', 4), n(71, 1000, 'right', 5)]
    expect(handPlaces(notes, 'right')).toEqual([{ hand: 'right', finger: 1, pitch: 64 }])
  })

  it('counts the left hand the other way: finger 5 on C is a thumb on G', () => {
    const notes = [n(48, 0, 'left', 5), n(50, 500, 'left', 4), n(52, 1000, 'left', 3)]
    expect(handPlaces(notes, 'left')).toEqual([{ hand: 'left', finger: 1, pitch: 55 }])
  })

  it('takes the middle of the first notes, so one odd finger doesn’t move it', () => {
    const notes = [60, 62, 64, 65, 67].map((p, i) => n(p, i * 500, 'right', (i + 1) as Finger)).concat([n(72, 3000, 'right', 5)])
    expect(handPlaces(notes, 'right')[0].pitch).toBe(60)
  })

  it('with no fingering: the right thumb on the lowest note, the left little finger on its lowest', () => {
    const notes = [n(64, 0, 'right'), n(67, 500, 'right'), n(45, 0, 'left'), n(48, 500, 'left')]
    expect(handPlaces(notes, 'both')).toEqual([
      { hand: 'right', finger: 1, pitch: 64 },
      { hand: 'left', finger: 5, pitch: 45 },
    ])
  })

  it('names a white key even when the lowest note is black', () => {
    expect(handPlaces([n(66, 0, 'right'), n(67, 500, 'right')], 'right')[0].pitch).toBe(65)
  })

  it('says nothing for a hand the song hasn’t got, and only for the hands practised', () => {
    const notes = [n(64, 0, 'right')]
    expect(handPlaces(notes, 'left')).toEqual([])
    expect(handPlaces([...notes, n(45, 0, 'left')], 'right')).toHaveLength(1)
  })
})
