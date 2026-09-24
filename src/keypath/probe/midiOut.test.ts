import { describe, expect, it } from 'vitest'
import type { MidiEvent } from '../midi/types'
import { ARPEGGIO, durationOf, echoed, messagesFor, STYLE_RUN_MS } from './midiOut'

const on = (note: number, time: number, channel = 1) => ({ type: 'noteon', note, velocity: 90, channel, time }) as unknown as MidiEvent

describe('MIDI-out checks', () => {
  it('plays C E G C on channel 1, every note released, then silences the channel', () => {
    const m = messagesFor('notes')
    expect(m.filter((x) => x.data[0] === 0x90).map((x) => x.data[1])).toEqual(ARPEGGIO)
    expect(m.filter((x) => x.data[0] === 0x80)).toHaveLength(4)
    expect(m.at(-1)!.data).toEqual([0xb0, 123, 0])
  })

  it('switches channel 2 to strings, plays there, and puts the piano back', () => {
    const m = messagesFor('voice')
    expect(m[0].data).toEqual([0xc1, 48])
    expect(m.filter((x) => x.data[0] === 0x91)).toHaveLength(4)
    expect(m.at(-1)!.data).toEqual([0xc1, 0])
  })

  it('starts the Style and stops it again', () => {
    expect(messagesFor('style')).toEqual([
      { data: [0xfa], at: 0 },
      { data: [0xfc], at: STYLE_RUN_MS },
    ])
    expect(durationOf('style')).toBe(STYLE_RUN_MS)
  })

  it('calls it an echo only when the test’s own notes come back while it runs', () => {
    expect(echoed(1000, [on(60, 1010)])).toBe(true)
    expect(echoed(1000, [on(62, 1010)])).toBe(false) // a key she pressed, not ours
    expect(echoed(1000, [on(60, 900)])).toBe(false) // before the test
    expect(echoed(1000, [on(60, 1000 + durationOf('notes') + 2000)])).toBe(false)
    expect(echoed(1000, [on(60, 1010)], 'style')).toBe(false)
  })
})
