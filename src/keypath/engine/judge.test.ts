import { describe, expect, it } from 'vitest'
import { Judge, type JudgeEvent } from './judge'
import { DEFAULT_SETTINGS, type JudgeSettings } from './settings'
import { odeToJoy, songOf } from './testing/songs'
import type { MidiEvent } from '../midi/types'

const wait: JudgeSettings = { ...DEFAULT_SETTINGS, onWrong: 'wait' }
const show: JudgeSettings = { ...DEFAULT_SETTINGS, onWrong: 'show' }
const types = (events: JudgeEvent[]) => events.map((e) => e.type)

describe('Judge — wait for it', () => {
  it('holds on each note until it is played, and finishes after the last', () => {
    const j = new Judge(songOf([[60, 0], [62, 500], [64, 1000]]), { practice: 'both', settings: wait })
    expect(j.mode).toBe('wait')
    expect(j.currentStep?.notes.map((n) => n.pitch)).toEqual([60])
    expect(types(j.press(60, 5000))).toEqual(['hit', 'advance'])
    // Nothing is ever late: a long pause is fine.
    expect(types(j.press(62, 60000))).toEqual(['hit', 'advance'])
    expect(types(j.press(64, 60001))).toEqual(['hit', 'done'])
    expect(j.summary()).toMatchObject({ done: true, total: 3, wrong: [] })
  })

  it('records a wrong key without moving on', () => {
    const j = new Judge(songOf([[60, 0], [62, 500]]), { practice: 'both', settings: wait })
    expect(j.press(61, 10)).toEqual([{ type: 'wrong', wrong: { pitch: 61, atMs: 10, bar: 0 } }])
    expect(j.currentStep?.index).toBe(0)
  })

  it('needs every note of a chord, in any order, and ignores a repeated chord key', () => {
    const j = new Judge(songOf([[60, 0], [64, 0], [67, 0], [72, 500]]), { practice: 'both', settings: wait })
    expect(types(j.press(67, 0))).toEqual(['hit'])
    expect(j.press(67, 5)).toEqual([])
    expect(types(j.press(60, 9))).toEqual(['hit'])
    expect(types(j.press(64, 12))).toEqual(['hit', 'advance'])
  })

  it('practises one hand at a time', () => {
    const song = songOf([[60, 0, 'right'], [48, 0, 'left'], [62, 500, 'right'], [50, 500, 'left']])
    const left = new Judge(song, { practice: 'left', settings: wait })
    expect(left.summary().total).toBe(2)
    expect(types(left.press(48, 0))).toEqual(['hit', 'advance'])
    expect(types(left.press(60, 1))).toEqual(['wrong']) // the right hand's note isn't expected now
  })
})

describe('Judge — running (show it / keep going)', () => {
  it('scores on time, early and late against each note’s moment', () => {
    const j = new Judge(songOf([[60, 0], [62, 1000], [64, 2000]]), { practice: 'both', settings: show })
    j.start(10_000)
    const hits = [j.press(60, 10_020), j.press(62, 10_800), j.press(64, 12_250)].flat()
    expect(hits.filter((e) => e.type === 'hit').map((e) => e.type === 'hit' && [e.result.timing, e.result.deltaMs])).toEqual([
      ['onTime', 20],
      ['early', -200],
      ['late', 250],
    ])
    expect(j.summary().done).toBe(true)
  })

  it('counts a key outside every window as wrong, and a note that goes by unplayed as missed', () => {
    const j = new Judge(songOf([[60, 0], [62, 1000]]), { practice: 'both', settings: { ...show, timing: 'strict' } })
    j.start(0)
    expect(types(j.press(60, 400))).toEqual(['wrong']) // strict window is ±110 ms
    expect(types(j.tick(500))).toEqual(['missed'])
    expect(types(j.press(62, 1000))).toEqual(['hit', 'done'])
  })

  it('plays slower at a lower tempo, stretching every moment', () => {
    const j = new Judge(songOf([[60, 0], [62, 1000]]), { practice: 'both', settings: show, tempo: 0.5 })
    j.start(0)
    j.press(60, 0)
    const [hit] = j.press(62, 2000)
    expect(hit.type === 'hit' && hit.result.timing).toBe('onTime')
  })

  it('starts the clock on the first key when not started explicitly', () => {
    const j = new Judge(songOf([[60, 0], [62, 500]]), { practice: 'both', settings: show })
    j.press(60, 7000)
    const [hit] = j.press(62, 7500)
    expect(hit.type === 'hit' && hit.result.deltaMs).toBe(0)
  })

  it('judges “keep going” exactly like “show it” — only what she sees differs', () => {
    const play = (settings: JudgeSettings) => {
      const j = new Judge(odeToJoy, { practice: 'both', settings })
      j.start(0)
      odeToJoy.notes.forEach((n, i) => j.press(i === 3 ? 69 : n.pitch, n.startMs + (i % 2 ? 60 : -40)))
      j.tick(99_999)
      return j.summary()
    }
    expect(play({ ...show, onWrong: 'keepGoing' })).toEqual(play(show))
  })
})

describe('Judge — pause and resume', () => {
  it('misses nothing while paused (a dropped keyboard), and carries on where it stopped', () => {
    const j = new Judge(songOf([[60, 0], [62, 1000]]), { practice: 'both', settings: show })
    j.start(0)
    j.press(60, 0)
    j.pause(500) // keyboard unplugged half a second in
    expect(j.tick(30_000)).toEqual([]) // half a minute later: nothing missed
    expect(j.songTime(30_000)).toBe(500)
    j.resume(30_000)
    const [hit] = j.press(62, 30_500) // the next note, half a second after resuming
    expect(hit.type === 'hit' && hit.result.timing).toBe('onTime')
  })

  it('ignores keys while paused', () => {
    const j = new Judge(songOf([[60, 0]]), { practice: 'both', settings: show })
    j.start(0)
    j.pause(0)
    expect(j.press(60, 0)).toEqual([])
  })
})

describe('Judge — from the MIDI layer', () => {
  const ev = (over: Partial<MidiEvent>): MidiEvent => ({ type: 'noteon', note: 60, velocity: 70, channel: 1, time: 0, receivedAt: 0, source: 'webmidi', deviceId: 'y', ...over } as MidiEvent)

  it('ignores the accompaniment, grazed keys and releases', () => {
    const j = new Judge(songOf([[38, 0]]), { practice: 'both', settings: wait })
    expect(j.midi(ev({ note: 38, channel: 10 }))).toEqual([]) // a Style's snare on channel 10
    expect(j.midi(ev({ note: 38, velocity: 1 }))).toEqual([]) // a graze
    expect(j.midi({ type: 'noteoff', note: 38, velocity: 0, viaZeroVelocity: true, channel: 1, time: 0, receivedAt: 0, source: 'webmidi', deviceId: 'y' })).toEqual([])
    expect(types(j.midi(ev({ note: 38 })))).toEqual(['hit', 'done'])
  })

  it('applies the octave shift found by the middle-C check', () => {
    const j = new Judge(songOf([[60, 0]]), { practice: 'both', settings: wait, shift: 12 })
    expect(types(j.midi(ev({ note: 48, channel: 3 })))).toEqual(['hit', 'done']) // Split voice at Octave −1
  })
})
