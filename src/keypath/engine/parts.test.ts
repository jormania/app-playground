import { describe, expect, it } from 'vitest'
import { splitHands, suggestSplit } from './parts'
import type { SongNote } from './song'
import { parseSmf } from './smf'
import { partsOf, songFromParts, suggestParts } from './parts'
import { stepsOf } from './song'
import { checkRange, transposeSong } from './range'
import { octaveShift } from './octave'
import { meta, off, on, smf, track } from './testing/smfBuilder'

// A typical downloaded arrangement: conductor, piano RH, piano LH, bass, drums.
function arrangement() {
  const conductor = track([meta.tempo(0, 100), meta.timeSig(0, 3, 4)])
  const rh = track([meta.name(0, 'Piano RH'), on(480, 1, 64), off(480, 1, 64), on(0, 1, 67), off(480, 1, 67), on(0, 1, 72), off(480, 1, 72)])
  const lh = track([meta.name(0, 'Piano LH'), on(480, 2, 48), on(0, 2, 52), off(1440, 2, 48), off(0, 2, 52)])
  const bass = track([meta.name(0, 'Fretless'), on(480, 3, 36), off(1440, 3, 36)])
  const drums = track([meta.name(0, 'Drums'), ...Array.from({ length: 6 }, (_, i) => [on(i ? 0 : 480, 10, 42), off(240, 10, 42)]).flat()])
  return parseSmf(smf(1, 480, [conductor, rh, lh, bass, drums]))
}

describe('parts', () => {
  it('lists each track+channel with its range, and marks drums', () => {
    const parts = partsOf(arrangement())
    expect(parts.map((p) => [p.name, p.channel, p.noteCount, p.isDrums])).toEqual([
      ['Piano RH', 1, 3, false],
      ['Piano LH', 2, 2, false],
      ['Fretless', 3, 1, false],
      ['Drums', 10, 6, true],
    ])
  })

  it('suggests the named piano right hand, and the left hand under it — never the drums', () => {
    const { right, left } = suggestParts(partsOf(arrangement()))
    expect(right?.name).toBe('Piano RH')
    expect(left?.name).toBe('Piano LH')
  })

  it('falls back to the busiest non-drum part when nothing is named', () => {
    const f = parseSmf(smf(0, 480, [track([on(0, 10, 36), off(10, 10, 36), on(0, 10, 38), off(10, 10, 38), on(0, 4, 60), off(10, 4, 60)])]))
    expect(suggestParts(partsOf(f))).toEqual({ right: expect.objectContaining({ channel: 4 }), left: null })
  })

  it('builds a song from the chosen parts: first note at 0 ms, hands, bars from the time signature', () => {
    const file = arrangement()
    const { right, left } = suggestParts(partsOf(file))
    const song = songFromParts(file, { id: 's', title: 'Waltz', right, left })
    expect(song).toMatchObject({ bpm: 100, beatsPerBar: 3 })
    // at 100 BPM a beat is 600 ms; the RH starts on beat 2 of bar 1, so the song starts there
    expect(song.notes.map((n) => [n.pitch, n.hand, n.startMs, n.bar])).toEqual([
      [48, 'left', 0, 0],
      [52, 'left', 0, 0],
      [64, 'right', 0, 0],
      [67, 'right', 600, 0],
      [72, 'right', 1200, 1],
    ])
    expect(stepsOf(song.notes).map((s) => s.notes.map((n) => n.pitch))).toEqual([[48, 52, 64], [67], [72]])
  })
})

describe('range', () => {
  it('passes a piece that fits the 61 keys', () => {
    expect(checkRange([48, 60, 72])).toMatchObject({ fits: true, suggestedShift: 0 })
  })

  it('suggests the smallest whole-octave move for a piece that sits too high or low', () => {
    expect(checkRange([88, 100])).toMatchObject({ fits: false, outside: 1, suggestedShift: -12 })
    expect(checkRange([24, 40])).toMatchObject({ suggestedShift: 12 })
  })

  it('admits when nothing fits', () => {
    expect(checkRange([21, 108]).suggestedShift).toBeNull()
  })

  it('transposes a song', () => {
    const song = { id: 'x', title: 'x', bpm: 120, beatsPerBar: 4, durationMs: 0, notes: [{ id: 0, pitch: 60, startMs: 0, durationMs: 1, hand: 'right' as const, bar: 0 }] }
    expect(transposeSong(song, -12).notes[0].pitch).toBe(48)
  })
})

describe('octaveShift', () => {
  it('reads the offset from a pressed middle C', () => {
    expect(octaveShift(60)).toBe(0)
    expect(octaveShift(48)).toBe(12) // Octave −1 on the voice
    expect(octaveShift(72)).toBe(-12)
  })

  it('refuses a key that is not a C', () => {
    expect(octaveShift(62)).toBeNull()
  })
})

describe('one part, two hands', () => {
  const notes = (triples: [number, number, number][]) => triples.map(([pitch, start]) => ({ pitch, startMs: start * 500 }))
  // A waltz for piano in one track: bass, then a chord up to F#4, and a melody from A4 up.
  const waltz: [number, number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((bar): [number, number, number][] => {
    const b = bar * 3
    return [[bar % 2 ? 38 : 43, b, 1], [bar % 2 ? 57 : 59, b + 1, 2], [62, b + 1, 2], [66, b + 1, 2], [[78, 81, 79, 78, 76, 74, 76, 74][bar], b + 1, 2]]
  })

  it('finds the gap between the hands, not just middle C: the chords stay in the left hand', () => {
    // G4: under it the bass and every chord (up to F#4), from it the melody (A4 up).
    expect(suggestSplit(notes(waltz))).toBe(67)
  })

  it('a melody alone is not split, however far it wanders either side of middle C', () => {
    const melody = [55, 57, 59, 60, 62, 64, 65, 67, 65, 64, 62, 60, 59, 57, 55, 60].map((p, i): [number, number, number] => [p, i, 1])
    expect(suggestSplit(notes(melody))).toBeNull()
  })

  it('a part all above middle C is not split', () => {
    const high = [60, 64, 67, 72, 64, 67, 72, 76, 60, 64, 67, 72].map((p, i): [number, number, number] => [p, Math.floor(i / 2), 1])
    expect(suggestSplit(notes(high))).toBeNull()
  })

  it('gives the notes below the line to the left hand', () => {
    const song = { id: 's', title: 's', bpm: 120, beatsPerBar: 3, durationMs: 0, notes: waltz.map(([pitch, start], id): SongNote => ({ id, pitch, startMs: start * 500, durationMs: 400, hand: 'right', bar: 0 })) }
    const split = splitHands(song, 68)
    expect(split.notes.filter((n) => n.hand === 'left').map((n) => n.pitch).sort((a, b) => a - b).at(-1)).toBe(66)
    expect(split.notes.filter((n) => n.hand === 'right').every((n) => n.pitch >= 69)).toBe(true)
  })
})
