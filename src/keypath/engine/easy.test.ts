import { describe, expect, it } from 'vitest'
import { bassPerBar, easyNotes, foldStrays, melody, whiterKey } from './easy'
import { fitSong } from './range'
import type { Hand, Song, SongNote } from './song'

let id = 0
const n = (pitch: number, startMs: number, durationMs = 450, hand: Hand = 'right', bar = Math.floor(startMs / 2000)): SongNote => ({ id: id++, pitch, startMs, durationMs, hand, bar })

describe('the right hand: the tune alone', () => {
  it('keeps the top note of each chord, and nothing from a voice moving under a held note', () => {
    const right = [
      // A chord: C E G, the tune on G.
      n(60, 0), n(64, 0), n(67, 5),
      // The tune holds A for a beat and a half; an inner voice moves under it.
      n(69, 500, 700), n(65, 700), n(64, 950),
      // The tune moves on while the voice below still holds: one note at a time.
      n(55, 1200, 1500), n(71, 1250), n(72, 1700),
    ]
    expect(melody(right).map((x) => x.pitch)).toEqual([67, 69, 71, 72])
    const b = melody([n(60, 0, 1000), n(72, 500)])
    expect(b.map((x) => [x.pitch, x.durationMs])).toEqual([[60, 500], [72, 450]])
  })
})

describe('the left hand: a note a bar', () => {
  it('plays the lowest of each bar’s first notes, held through the bar', () => {
    const left = [
      // Bar 0: running eighths over a C, then G.
      n(48, 0, 225, 'left'), n(55, 250, 225, 'left'), n(52, 500, 225, 'left'), n(55, 750, 225, 'left'), n(43, 1000, 900, 'left'),
      // Bar 1: an octave, F.
      n(41, 2000, 1800, 'left'), n(53, 2000, 1800, 'left'),
    ]
    const bass = bassPerBar(left)
    expect(bass.map((x) => [x.pitch, x.startMs, x.durationMs])).toEqual([
      [48, 0, 1900],
      [41, 2000, 1800],
    ])
  })

  it('never holds one bar’s note into the next', () => {
    const bass = bassPerBar([n(48, 0, 2400, 'left', 0), n(41, 2000, 450, 'left', 1)])
    expect(bass[0].durationMs).toBe(1900)
  })
})

describe('stray notes', () => {
  it('move by whole octaves to where the rest of the hand plays; the rest stay as written', () => {
    // A tune around B♭4–C♯6, with a low B♭1 and an F♯2 from the arrangement's bass.
    const tune = [70, 72, 73, 75, 77, 73, 70, 82, 84, 85, 73, 70].map((p, i) => n(p, i * 500))
    const folded = foldStrays([...tune, n(34, 6000), n(42, 6500)])
    expect(folded.slice(0, tune.length).map((x) => x.pitch)).toEqual(tune.map((x) => x.pitch))
    expect(folded.slice(tune.length).map((x) => x.pitch)).toEqual([70, 78])
  })

  it('leave a short hand alone: too few notes to say where it plays', () => {
    expect(foldStrays([n(34, 0), n(72, 500), n(74, 1000)]).map((x) => x.pitch)).toEqual([34, 72, 74])
  })
})

describe('the key', () => {
  it('moves a song mostly on black keys to the nearest key with the fewest', () => {
    // B♭ minor: B♭ C D♭ E♭ F G♭ A♭. One semitone down is A minor, all white.
    const bflatMinor = [70, 72, 73, 75, 77, 78, 80, 70, 73, 77].map((p, i) => n(p, i * 500))
    expect(whiterKey(bflatMinor)).toBe(-1)
    // C major stays: no black keys to lose.
    expect(whiterKey([60, 62, 64, 65, 67, 69, 71].map((p, i) => n(p, i * 500)))).toBe(0)
    // A few black keys (a tune in G, its F♯) aren't worth moving it for.
    expect(whiterKey([67, 69, 71, 72, 74, 76, 78, 79, 74, 71, 67].map((p, i) => n(p, i * 500)))).toBe(0)
  })
})

describe('the easy version of a song', () => {
  const song = (): Song => {
    const right = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84].flatMap((p, i) => [n(p, i * 500), n(p - 12, i * 500)])
    const left = Array.from({ length: 24 }, (_, i) => n(i % 2 ? 43 : 36, i * 250, 225, 'left'))
    return { id: 'import:x', title: 'X', notes: [...right, ...left], bpm: 120, beatsPerBar: 4, durationMs: 6000 }
  }

  it('is thinner, keeps the ids of the notes it plays, and is made from the notes as written every time', () => {
    const s = song()
    const easy = easyNotes(s.notes)
    expect(easy.filter((x) => x.hand === 'right')).toHaveLength(12)
    expect(easy.filter((x) => x.hand === 'left').map((x) => x.pitch)).toEqual([36, 36, 36])
    expect(easy.every((x) => s.notes.some((w) => w.id === x.id))).toBe(true)
  })

  it('can be switched on and off again, and off is the song exactly as written', () => {
    const s = song()
    const on = fitSong({ ...s, easy: true }, null)
    expect(on.notes.length).toBe(15)
    expect(on.source).toHaveLength(48)
    const off = fitSong({ ...on, easy: false }, null)
    expect(off.notes).toEqual(s.notes)
    expect(off.source).toBeUndefined()
  })
})
