import { describe, expect, it } from 'vitest'
import { notesFor } from '../../../engine'
import { STARTER_PACK, starterSong } from '../../../engine/starterPack'
import { songOf } from '../../../engine/testing/songs'
import { barTimesOf, notationBars, writtenLengths, type NotationEvent } from './model'

const starter = (id: string) => starterSong(STARTER_PACK.find((s) => s.id === `starter:${id}`)!)
const lengths = (events: NotationEvent[] | undefined) => (events ?? []).map((e) => (e.keys.length ? e.length : `r${e.length}`))

describe('writtenLengths', () => {
  it('splits a length into written values, longest first', () => {
    expect(writtenLengths(4)).toEqual([4])
    expect(writtenLengths(5)).toEqual([4, 1])
    expect(writtenLengths(3.5)).toEqual([3, 0.5])
    expect(writtenLengths(0.75)).toEqual([0.75])
    expect(writtenLengths(1.25)).toEqual([1, 0.25])
  })
})

describe('notationBars', () => {
  it('writes Ode to Joy as quarter notes, bar by bar', () => {
    const song = starter('ode')
    const bars = notationBars(song, notesFor(song, 'right'), ['treble'])
    expect(lengths(bars[0].staves.treble)).toEqual([1, 1, 1, 1])
    expect(bars[0].staves.treble![0].keys[0].pitch).toBe(64)
    expect(bars[0].staves.bass).toBeUndefined()
  })

  it('puts each hand on its own staff: Twinkle’s held bass note is a whole note', () => {
    const song = starter('twinkle')
    const bars = notationBars(song, notesFor(song, 'both'), ['treble', 'bass'])
    expect(lengths(bars[0].staves.treble)).toEqual([1, 1, 1, 1])
    expect(lengths(bars[1].staves.treble)).toEqual([1, 1, 2])
    expect(lengths(bars[0].staves.bass)).toEqual([4])
    expect(lengths(bars[1].staves.bass)).toEqual([2, 2])
  })

  it('ties a note held over the bar line into the next bar', () => {
    // When the Saints: C E F G, the G held five beats.
    const song = starter('saints')
    const bars = notationBars(song, notesFor(song, 'right'), ['treble'])
    const [first, second] = [bars[0].staves.treble!, bars[1].staves.treble!]
    expect(lengths(first)).toEqual([1, 1, 1, 1])
    expect(first[3].tie).toBe(true)
    expect(lengths(second)).toEqual([4])
    expect(second[0].keys[0].id).toBe(first[3].keys[0].id)
    expect(second[0].tie).toBe(false)
  })

  it('writes Für Elise in 3/8: six sixteenths a bar', () => {
    const song = starter('elise')
    const bars = notationBars(song, notesFor(song, 'right'), ['treble'])
    expect(bars[0].quarters).toBe(1.5)
    expect(lengths(bars[0].staves.treble)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25])
    expect(lengths(bars[1].staves.treble)).toEqual([0.25, 0.25, 0.75, 0.25])
  })

  it('gives a short note a plain value and a rest for the silence after it, and an empty bar a whole rest', () => {
    // Quarter notes at 120 bpm are 500 ms: C sounds 400 ms, then two beats' silence; nothing in the left hand.
    const song = { ...songOf([[60, 0], [62, 1500]], 'Short'), bpm: 120, beatsPerBar: 4 }
    const bars = notationBars(song, song.notes, ['treble', 'bass'])
    expect(lengths(bars[0].staves.treble)).toEqual([1, 'r2', 1])
    expect(bars[0].staves.bass).toEqual([{ at: 0, length: 4, keys: [], tie: false, wholeBar: true }])
  })

  it('writes notes struck together as one chord, lowest first', () => {
    const song = { ...songOf([[67, 0], [60, 5], [64, 10]], 'Chord'), bpm: 120, beatsPerBar: 4 }
    const [bar] = notationBars(song, song.notes, ['treble'])
    expect(bar.staves.treble![0].keys.map((k) => k.pitch)).toEqual([60, 64, 67])
  })
})

describe('barTimesOf', () => {
  it('uses the song’s own bars, or works them out so every note falls in its bar', () => {
    const song = starter('ode')
    expect(barTimesOf(song, song.notes)).toBe(song.barTimes)
    // A pickup: the first note a beat before bar 1.
    const notes = songOf([[67, 0], [72, 500], [74, 1000]], 'Up').notes.map((n, i) => ({ ...n, bar: i === 0 ? 0 : 1 }))
    const times = barTimesOf({ bpm: 120, beatsPerBar: 4 }, notes)
    expect(times[1].startMs).toBe(500)
    expect(times[0]).toEqual({ startMs: -1500, endMs: 500, quarters: 4 })
  })
})
