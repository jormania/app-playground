import { describe, expect, it } from 'vitest'
import { emptyTracker, track } from './noteTracker'
import type { MidiEvent } from './types'

const base = { receivedAt: 0, source: 'webmidi' as const, deviceId: 'x', channel: 1 }
const on = (note: number, time: number, velocity = 80): MidiEvent => ({ ...base, type: 'noteon', note, velocity, time })
const off = (note: number, time: number): MidiEvent => ({ ...base, type: 'noteoff', note, velocity: 0, viaZeroVelocity: true, time })
const run = (events: MidiEvent[]) => events.reduce(track, emptyTracker())

describe('track', () => {
  it('holds every key of a chord at once, sorted', () => {
    const s = run([on(67, 0), on(60, 3), on(64, 5)])
    expect(s.held.map((h) => h.note)).toEqual([60, 64, 67])
  })

  it('turns an on/off pair into a played note with its duration', () => {
    const s = run([on(60, 1000, 74), off(60, 1340)])
    expect(s.held).toEqual([])
    expect(s.lastPlayed).toMatchObject({ note: 60, velocity: 74, onTime: 1000, offTime: 1340, durationMs: 340 })
    expect(s.counts).toMatchObject({ noteOn: 1, noteOff: 1, zeroVelocityOffs: 1 })
  })

  it('counts a Note Off with no Note On as an orphan', () => {
    expect(run([off(60, 0)]).counts.orphanOffs).toBe(1)
  })

  it('counts a second Note On for a held key as a lost Note Off', () => {
    const s = run([on(60, 0), on(60, 10)])
    expect(s.counts.doubleOns).toBe(1)
    expect(s.held).toHaveLength(1)
  })

  it('flags timestamps that go backwards', () => {
    expect(run([on(60, 10), off(60, 5)]).counts.outOfOrder).toBe(1)
  })

  it('records range, velocity spread, channels and the sustain pedal', () => {
    const s = run([on(40, 0, 20), on(90, 1, 110), { ...base, channel: 2, type: 'cc', controller: 64, value: 127, time: 2 }])
    expect(s).toMatchObject({ lowest: 40, highest: 90, velocities: { min: 20, max: 110 }, channels: [1], sustain: true })
  })

  it('counts realtime bytes without letting them disturb note state', () => {
    const s = run([on(60, 0), { receivedAt: 0, source: 'webmidi', deviceId: 'x', type: 'realtime', status: 0xfe, time: 1 }])
    expect(s.counts.realtime).toEqual({ FE: 1 })
    expect(s.held).toHaveLength(1)
  })
})
