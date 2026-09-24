import { describe, expect, it } from 'vitest'
import { emptyClock, tempoOf, trackClock, type ClockState } from './clockTracker'
import type { MidiEvent } from './types'

const rt = (status: number, time: number): MidiEvent => ({ type: 'realtime', status, time, receivedAt: time, source: 'webmidi', deviceId: 'y' })

function ticksAt(bpm: number, count: number, start = 0, state: ClockState = emptyClock()): ClockState {
  const interval = 60000 / (bpm * 24)
  for (let i = 0; i < count; i++) state = trackClock(state, rt(0xf8, start + i * interval))
  return state
}

describe('clock tempo', () => {
  it('reads 120 BPM from ticks 20.83 ms apart', () => {
    const s = ticksAt(120, 60)
    expect(tempoOf(s, s.ticks.at(-1)!)).toMatchObject({ bpm: 120, jitterMs: 0 })
  })

  it('reads the ~78 BPM measured from the PSR-E383 on the S24', () => {
    const s = ticksAt(78, 60)
    expect(tempoOf(s, s.ticks.at(-1)!)?.bpm).toBe(78)
  })

  it('follows a tempo change within two beats', () => {
    let s = ticksAt(80, 60)
    s = ticksAt(140, 49, s.ticks.at(-1)! + 60000 / (140 * 24), s)
    expect(tempoOf(s, s.ticks.at(-1)!)?.bpm).toBe(140)
  })

  it('says nothing until there are a few ticks, or once the clock has gone quiet', () => {
    const few = ticksAt(120, 3)
    expect(tempoOf(few, 100)).toBeNull()
    const s = ticksAt(120, 60)
    expect(tempoOf(s, s.ticks.at(-1)! + 1500)).toBeNull()
  })

  it('tracks Start and Stop from Style playback', () => {
    let s = trackClock(emptyClock(), rt(0xfa, 0))
    expect(s.transport).toBe('playing')
    s = trackClock(s, rt(0xfc, 10))
    expect(s).toMatchObject({ transport: 'stopped', starts: 1, stops: 1 })
  })

  it('ignores everything that is not realtime', () => {
    const s = emptyClock()
    const note: MidiEvent = { type: 'noteon', note: 60, velocity: 80, channel: 1, time: 0, receivedAt: 0, source: 'webmidi', deviceId: 'y' }
    expect(trackClock(s, note)).toBe(s)
  })
})
