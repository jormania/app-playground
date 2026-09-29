import { describe, expect, it } from 'vitest'
import { STARTER_PACK, starterSong } from './starterPack'
import { fingeringProblems } from './testing/fingering'
import { fitSong } from './range'
import { suggestFingers, withSuggestedFingers } from './fingering'
import type { Finger, Hand, Song, SongNote } from './song'

let id = 0
const n = (pitch: number, i: number, hand: Hand = 'right', finger?: Finger): SongNote => ({ id: id++, pitch, startMs: i * 500, durationMs: 450, hand, bar: Math.floor(i / 4), ...(finger ? { finger } : {}) })
const line = (pitches: number[], hand: Hand = 'right') => pitches.map((p, i) => n(p, i, hand))
const fingers = (notes: readonly SongNote[]) => notes.map((x) => x.finger).join('')

describe('suggested fingers: a run of single notes', () => {
  it('goes up five notes on five fingers and comes back down', () => {
    expect(fingers(suggestFingers(line([60, 62, 64, 65, 67])))).toBe('12345')
    expect(fingers(suggestFingers(line([67, 65, 64, 62, 60])))).toBe('54321')
  })

  it('tucks the thumb under when a scale outruns five fingers, and crosses over coming back', () => {
    // The classic C major scale, right hand: 1 2 3 1 2 3 4 5 up, and 5 4 3 2 1 3 2 1 down.
    expect(fingers(suggestFingers(line([60, 62, 64, 65, 67, 69, 71, 72])))).toBe('12312345')
    expect(fingers(suggestFingers(line([72, 71, 69, 67, 65, 64, 62, 60])))).toBe('54321321')
  })

  it('keeps a repeated note on the same finger', () => {
    const f = suggestFingers(line([60, 60, 67, 67, 69, 69, 67])).map((x) => x.finger)
    expect(f[0]).toBe(f[1])
    expect(f[2]).toBe(f[3])
    expect(f[4]).toBe(f[5])
  })

  it('mirrors for the left hand: the thumb is its highest note', () => {
    expect(fingers(suggestFingers(line([48, 50, 52, 53, 55], 'left')))).toBe('54321')
    expect(fingers(suggestFingers(line([55, 53, 52, 50, 48], 'left')))).toBe('12345')
  })

  it('keeps the thumb off a black key when it can', () => {
    // C D E♭ F G: the thumb on C, E♭ is the third note under the middle finger.
    const f = suggestFingers(line([60, 62, 63, 65, 67]))
    expect(f[2].finger).not.toBe(1)
  })

  it('moves the hand for a big leap rather than stretching', () => {
    const f = suggestFingers(line([60, 62, 72, 74])).map((x) => x.finger)
    expect(f.every((x) => x && x >= 1 && x <= 5)).toBe(true)
  })
})

describe('suggested fingers: chords and rests', () => {
  it('fingers a chord by its size: thumb to little finger, mirrored for the left hand', () => {
    const chord = (hand: Hand, pitches: number[]) => pitches.map((p) => n(p, 0, hand))
    expect(fingers(suggestFingers(chord('right', [60, 64, 67])))).toBe('135')
    expect(fingers(suggestFingers(chord('left', [43, 47, 50])))).toBe('531')
    expect(fingers(suggestFingers(chord('right', [60, 72])))).toBe('15')
    expect(fingers(suggestFingers(chord('right', [60, 63])))).toBe('13')
  })

  it('leaves a chord of more notes than a hand has fingers alone', () => {
    const six = [60, 62, 64, 65, 67, 69].map((p) => n(p, 0))
    expect(suggestFingers(six).some((x) => x.finger)).toBe(false)
  })
})

describe('suggested fingers: never over a score’s own', () => {
  it('leaves a song alone when any note has a finger written', () => {
    const notes = [n(60, 0, 'right', 3), n(62, 1), n(64, 2)]
    expect(suggestFingers(notes).map((x) => x.finger)).toEqual([3, undefined, undefined])
  })

  const song = (notes: SongNote[]): Song => ({ id: 'import:f', title: 'F', notes, bpm: 100, beatsPerBar: 4, durationMs: 4000 })

  it('marks the song when they are suggestions, and recomputes them when its notes change', () => {
    const fitted = fitSong(song(line([60, 62, 64, 65, 67])), null)
    expect(fitted.fingersSuggested).toBe(true)
    expect(fingers(fitted.notes)).toBe('12345')
    // Moved up a semitone: black keys under the thumb now, so the fingering is worked out again for these notes.
    const up = fitSong({ ...fitted, transpose: 1 }, null)
    expect(up.fingersSuggested).toBe(true)
    expect(up.notes.map((x) => x.pitch)).toEqual([61, 63, 65, 66, 68])
    // Back as written: the notes as written have none, and the suggestion is made for them again.
    expect(fingers(fitSong({ ...up, transpose: undefined }, null).notes)).toBe('12345')
  })

  it('does not mark a song whose score wrote its fingers', () => {
    const written = fitSong(song([n(60, 0, 'right', 1), n(62, 1, 'right', 2)]), null)
    expect(written.fingersSuggested).toBeUndefined()
    expect(withSuggestedFingers(written)).toBe(written)
  })
})

describe('suggested fingers on real tunes', () => {
  // The starter pack without its written fingering: the suggestion has to hold together by the same rules.
  for (const s of STARTER_PACK.filter((x) => x.id !== 'starter:warmup')) {
    it(`${s.id}: no finger goes against the keys, no repeated note changes finger`, () => {
      const bare = starterSong({ ...s, fingers: undefined })
      const suggested = suggestFingers(bare.notes)
      expect(suggested.every((x) => x.finger), 'a finger for every note').toBe(true)
      expect(fingeringProblems({ ...bare, notes: suggested })).toEqual([])
    })
  }
})
