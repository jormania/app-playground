// End to end without a screen: a MIDI file as it would arrive from "Add song",
// through the part picker, into the judge fed by the MIDI layer's own parser,
// out to the report — the path every door will use.
import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from '../midi/parse'
import { buildReport } from './feedback'
import { Judge } from './judge'
import { partsOf, songFromParts, suggestParts } from './parts'
import { checkRange } from './range'
import { DEFAULT_SETTINGS } from './settings'
import { parseSmf } from './smf'
import { melodyFile } from './testing/smfBuilder'

const ODE = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62].map((p): [number, number] => [p, 1])

describe('KeyPath engine, end to end', () => {
  it('imports a melody, judges a performance arriving as raw MIDI bytes, and reports', () => {
    const file = parseSmf(melodyFile(ODE, { bpm: 120, name: 'Ode to Joy (melody)' }))
    const { right, left } = suggestParts(partsOf(file))
    const song = songFromParts(file, { id: 'ode', title: 'Ode to Joy', right, left })
    expect(checkRange(song.notes.map((n) => n.pitch)).fits).toBe(true)

    const judge = new Judge(song, { practice: 'right', settings: DEFAULT_SETTINGS })
    const t0 = 50_000
    judge.start(t0)
    // She plays it on the PSR-E383: channel 1, Note Off as velocity 0, a little
    // human wobble, and one slip on the 4th note (A instead of G).
    song.notes.forEach((n, i) => {
      const at = t0 + n.startMs + (i % 3) * 25
      const pitch = i === 3 ? 69 : n.pitch
      const noteOn = parseMidiMessage([0x90, pitch, 64], { time: at, receivedAt: at + 2, source: 'webmidi', deviceId: 'y' })!
      const noteOff = parseMidiMessage([0x90, pitch, 0], { time: at + 300, receivedAt: at + 302, source: 'webmidi', deviceId: 'y' })!
      judge.midi(noteOn)
      judge.midi(noteOff)
    })
    judge.tick(t0 + song.durationMs + 1000)

    const report = buildReport(judge.summary(), DEFAULT_SETTINGS)
    expect(report).toMatchObject({ stars: 3, hit: 14, total: 15, missed: 1, wrong: 1 })
    expect(report.highlights[0]).toEqual({ kind: 'finished' })
    expect(report.toWorkOn).toEqual([{ bar: 0, missed: 1, wrong: 1, early: 0, late: 0 }])
  })
})
