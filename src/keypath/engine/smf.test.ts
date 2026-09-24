import { describe, expect, it } from 'vitest'
import { parseSmf, SmfError, tickToMs } from './smf'
import { melodyFile, meta, off, on, smf, track } from './testing/smfBuilder'

describe('parseSmf', () => {
  it('reads a simple melody with its timing, name and time signature', () => {
    const f = parseSmf(melodyFile([[60, 1], [62, 1], [64, 2]], { bpm: 120 }))
    expect(f).toMatchObject({ format: 0, ticksPerQuarter: 480, tracks: [{ name: 'Melody' }], timeSignatures: [{ numerator: 4, denominator: 4 }] })
    expect(f.notes.map((n) => [n.pitch, n.startMs, n.endMs])).toEqual([
      [60, 0, 500],
      [62, 500, 1000],
      [64, 1000, 2000],
    ])
  })

  it('treats Note On with velocity 0 as Note Off, and follows running status', () => {
    // 0x90 60 80, then running status: "62 80", "60 0" (off), "62 0" (off)
    const t = track([
      { dt: 0, raw: [0x90, 60, 80] },
      { dt: 0, raw: [62, 80] },
      { dt: 480, raw: [60, 0] },
      { dt: 0, raw: [62, 0] },
    ])
    const f = parseSmf(smf(0, 480, [t]))
    expect(f.notes.map((n) => [n.pitch, n.startTick, n.endTick])).toEqual([
      [60, 0, 480],
      [62, 0, 480],
    ])
  })

  it('pairs a re-struck key first-on, first-off', () => {
    const t = track([on(0, 1, 60), on(240, 1, 60), off(240, 1, 60), off(240, 1, 60)])
    const f = parseSmf(smf(0, 480, [t]))
    expect(f.notes.map((n) => [n.startTick, n.endTick])).toEqual([
      [0, 480],
      [240, 720],
    ])
  })

  it('applies tempo changes from the conductor track to every track (format 1)', () => {
    const conductor = track([meta.tempo(0, 120), meta.tempo(960, 60)])
    const music = track([meta.name(0, 'Piano RH'), on(0, 1, 60), off(960, 1, 60), on(0, 1, 62), off(480, 1, 62)])
    const f = parseSmf(smf(1, 480, [conductor, music]))
    expect(f.tracks.map((t) => t.name)).toEqual(['', 'Piano RH'])
    // two beats at 120 = 1000 ms, then one beat at 60 = 1000 ms
    expect(f.notes.map((n) => [n.startMs, n.endMs])).toEqual([
      [0, 1000],
      [1000, 2000],
    ])
  })

  it('keeps channels, skips SysEx, meta and unknown chunks', () => {
    const t = track([{ dt: 0, raw: [0xf0, 3, 0x7e, 0x7f, 0xf7] }, on(0, 10, 38), off(120, 10, 38), on(0, 4, 48), off(120, 4, 48)])
    const junk = [0x58, 0x58, 0x58, 0x58, 0, 0, 0, 2, 1, 2]
    const f = parseSmf(smf(1, 480, [t], [junk]))
    expect(f.notes.map((n) => [n.channel, n.pitch])).toEqual([
      [10, 38],
      [4, 48],
    ])
  })

  it('ends a note that is never released at the end of its track', () => {
    const f = parseSmf(smf(0, 480, [track([on(0, 1, 60), { dt: 960, meta: 0x01, data: [] }])]))
    expect(f.notes[0]).toMatchObject({ startTick: 0, endTick: 960 })
  })

  it('rejects what it cannot read, with a reason', () => {
    expect(() => parseSmf(new Uint8Array([1, 2, 3]))).toThrow(SmfError)
    expect(() => parseSmf(new TextEncoder().encode('RIFF....WAVEfmt '))).toThrow(/Not a MIDI file/)
    const smpte = smf(0, 480, [track([])])
    smpte[12] = 0xe7 // negative division = SMPTE timing
    expect(() => parseSmf(smpte)).toThrow(/SMPTE/)
    const f2 = smf(0, 480, [track([])])
    f2[9] = 2
    expect(() => parseSmf(f2)).toThrow(/format 2/)
  })
})

describe('tickToMs', () => {
  it('defaults to 120 BPM with no tempo events', () => {
    expect(tickToMs([], 480)(480)).toBe(500)
  })
})
