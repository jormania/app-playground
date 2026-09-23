import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from './parse'

const ctx = { time: 100, receivedAt: 102, source: 'webmidi' as const, deviceId: 'in-1' }

describe('parseMidiMessage', () => {
  it('reads a Note On with channel, note and velocity', () => {
    expect(parseMidiMessage([0x90, 60, 74], ctx)).toMatchObject({ type: 'noteon', channel: 1, note: 60, velocity: 74, time: 100, receivedAt: 102 })
  })

  it('treats Note On velocity 0 as Note Off — the only Note Off the PSR-E383 sends', () => {
    expect(parseMidiMessage([0x90, 60, 0], ctx)).toMatchObject({ type: 'noteoff', note: 60, velocity: 0, viaZeroVelocity: true })
  })

  it('still understands a true 8nH Note Off from other keyboards', () => {
    expect(parseMidiMessage([0x82, 64, 40], ctx)).toMatchObject({ type: 'noteoff', channel: 3, note: 64, velocity: 40, viaZeroVelocity: false })
  })

  it('numbers channels 1–16', () => {
    expect(parseMidiMessage([0x9f, 60, 1], ctx)).toMatchObject({ channel: 16 })
  })

  it('reads the sustain pedal as CC 64', () => {
    expect(parseMidiMessage([0xb0, 64, 127], ctx)).toMatchObject({ type: 'cc', controller: 64, value: 127 })
  })

  it('classifies clock and active sensing as realtime, never as notes', () => {
    expect(parseMidiMessage([0xfe], ctx)).toMatchObject({ type: 'realtime', status: 0xfe })
    expect(parseMidiMessage([0xf8], ctx)).toMatchObject({ type: 'realtime', status: 0xf8 })
  })

  it('keeps SysEx and pitch bend raw', () => {
    expect(parseMidiMessage([0xf0, 0x43, 0xf7], ctx)).toMatchObject({ type: 'other', data: [0xf0, 0x43, 0xf7] })
    expect(parseMidiMessage([0xe0, 0, 64], ctx)).toMatchObject({ type: 'other' })
  })

  it('ignores empty messages and stray data bytes', () => {
    expect(parseMidiMessage([], ctx)).toBeNull()
    expect(parseMidiMessage([60, 70], ctx)).toBeNull()
  })

  it('accepts the Uint8Array Web MIDI actually delivers', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 72, 90]), ctx)).toMatchObject({ type: 'noteon', note: 72 })
  })
})
