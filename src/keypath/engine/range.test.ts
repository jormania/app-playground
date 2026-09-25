import { describe, expect, it } from 'vitest'
import { applyFit, checkRange, defaultFit, fitOptions, fitSong, KEYBOARD_RANGE } from './range'
import type { Hand, Song, SongNote } from './song'

const n = (id: number, pitch: number, startMs: number, hand: Hand = 'right'): SongNote => ({ id, pitch, startMs, durationMs: 400, hand, bar: Math.floor(startMs / 2000) })
const song = (notes: SongNote[]): Song => ({ id: 'import:x', title: 'X', notes, bpm: 120, beatsPerBar: 4, durationMs: 4000 })
const pitches = (ns: readonly SongNote[]) => ns.map((x) => x.pitch)

describe('fitting a song to the 61 keys', () => {
  it('offers nothing when every note fits', () => {
    expect(fitOptions([n(0, 60, 0), n(1, 96, 500)])).toEqual([])
  })

  it('a song too high but narrow enough: the whole song down first, then the stray notes, then leaving them out', () => {
    const notes = [n(0, 90, 0), n(1, 100, 500), n(2, 103, 1000)]
    const opts = fitOptions(notes)
    expect(opts.map((o) => o.mode)).toEqual(['moveSong', 'moveNotes', 'dropNotes'])
    expect(pitches(opts[0].notes)).toEqual([78, 88, 91])
    expect(opts[0].shift).toEqual({ right: -12, left: -12 })
    // Only the two notes above C7 move; the first stays where it was written.
    expect(pitches(opts[1].notes)).toEqual([90, 88, 91])
    expect(opts[1].moved).toBe(2)
    expect(pitches(opts[2].notes)).toEqual([90])
    expect(opts[2].dropped).toBe(2)
  })

  it('wider than the keyboard but each hand fits: each hand moves on its own', () => {
    // A left hand down at A0 and a right hand up at C8: 87 keys apart.
    const notes = [n(0, 21, 0, 'left'), n(1, 33, 500, 'left'), n(2, 108, 0), n(3, 96, 500)]
    expect(checkRange(pitches(notes)).suggestedShift).toBeNull()
    const opts = fitOptions(notes)
    expect(opts.map((o) => o.mode)).toEqual(['moveHands', 'moveNotes', 'dropNotes'])
    expect(opts[0].shift).toEqual({ right: -12, left: 24 })
    expect(opts[0].notes.every((x) => x.pitch >= KEYBOARD_RANGE.low && x.pitch <= KEYBOARD_RANGE.high)).toBe(true)
  })

  it('a hand wider than the keyboard on its own: only the note-by-note choices', () => {
    const notes = [n(0, 21, 0), n(1, 100, 500), n(2, 60, 1000, 'left')]
    expect(fitOptions(notes).map((o) => o.mode)).toEqual(['moveNotes', 'dropNotes'])
    expect(applyFit(notes, 'moveSong')).toBeNull()
    expect(applyFit(notes, 'moveHands')).toBeNull()
  })

  it('a moved note that lands on a key already sounding is left out, not pressed twice', () => {
    // C1 (24) under a C2 (36) played with it: moved up, it would be the same key.
    const notes = [n(0, 24, 0, 'left'), n(1, 36, 0, 'left'), n(2, 26, 500, 'left')]
    const r = applyFit(notes, 'moveNotes')!
    expect(pitches(r.notes)).toEqual([36, 38])
    expect([r.moved, r.dropped]).toEqual([1, 1])
  })

  it('by default, a few stray notes move on their own; a song in the wrong octave moves whole', () => {
    // Five low bass notes in three hundred and seventeen (the Gymnop\u00e9die case): only they move.
    const mostlyFine = [...Array.from({ length: 312 }, (_, i) => n(i, 50 + (i % 30), i * 100)), ...[0, 1, 2, 3, 4].map((k) => n(312 + k, 31, k * 1000, 'left'))]
    const opts = fitOptions(mostlyFine)
    expect(opts[0].mode).toBe('moveSong')
    expect(defaultFit(opts, mostlyFine.length)).toBe('moveNotes')
    expect(fitSong(song(mostlyFine), null).fit).toBe('moveNotes')
    // Everything an octave too high: the whole song moves.
    const allHigh = [n(0, 100, 0), n(1, 103, 500), n(2, 98, 1000)]
    expect(defaultFit(fitOptions(allHigh), allHigh.length)).toBe('moveSong')
  })

  it('when the one stray note would only double a key already sounding, moving is not offered, and leaving it out is the default', () => {
    // A low C under the C an octave above it, played together (the Stranger Things case: 1 note in 249).
    const notes = [n(0, 24, 0, 'left'), n(1, 36, 0, 'left'), ...Array.from({ length: 60 }, (_, i) => n(2 + i, 60 + (i % 12), 500 + i * 250))]
    const opts = fitOptions(notes)
    expect(opts.map((o) => o.mode)).toEqual(['moveSong', 'dropNotes'])
    expect(defaultFit(opts, notes.length)).toBe('dropNotes')
  })

  it('keeps the notes as written, so the choice can be changed later', () => {
    const wide = song([n(0, 100, 0), n(1, 60, 500)])
    const first = fitSong(wide, 'dropNotes')
    expect(first.fit).toBe('dropNotes')
    expect(pitches(first.notes)).toEqual([60])
    expect(pitches(first.source!)).toEqual([100, 60])
    const again = fitSong(first, 'moveNotes')
    expect(again.fit).toBe('moveNotes')
    expect(pitches(again.notes)).toEqual([88, 60])
    // No choice asked for: the best one.
    expect(fitSong(wide, null).fit).toBe('moveSong')
    // A song that fits carries nothing extra.
    expect(fitSong(song([n(0, 60, 0)]), null)).toMatchObject({ source: undefined, fit: undefined })
  })
})
