import type { MidiEvent } from './types'

// MIDI Clock is 24 ticks (F8) per quarter note. The PSR-E383 sends it
// continuously — measured on the S24 as a steady ~31 ticks/s with nothing
// playing — plus Start (FA) / Stop (FC) around Style playback, per its Data
// List. So the keyboard's own tempo setting can be read from the wire.
export const TICKS_PER_BEAT = 24
/** Two beats of ticks: enough to smooth USB jitter, short enough to follow a tempo change within a second or two. */
const WINDOW = 2 * TICKS_PER_BEAT
/** No tick for this long and the clock counts as stopped. At 11 BPM (the keyboard's minimum) ticks are ~227 ms apart. */
export const CLOCK_STALE_MS = 1000

export interface ClockState {
  /** Timestamps of the most recent ticks, oldest first. */
  ticks: number[]
  /** Style/Song transport, from Start/Continue/Stop. 'unknown' until one is seen. */
  transport: 'playing' | 'stopped' | 'unknown'
  starts: number
  stops: number
}

export const emptyClock = (): ClockState => ({ ticks: [], transport: 'unknown', starts: 0, stops: 0 })

export function trackClock(state: ClockState, e: MidiEvent): ClockState {
  if (e.type !== 'realtime') return state
  switch (e.status) {
    case 0xf8: {
      const ticks = state.ticks.length >= WINDOW + 1 ? state.ticks.slice(1) : state.ticks.slice()
      ticks.push(e.time)
      return { ...state, ticks }
    }
    case 0xfa:
      // Start restarts the count; a tempo measured across a restart would be meaningless.
      return { ...state, transport: 'playing', starts: state.starts + 1 }
    case 0xfb:
      return { ...state, transport: 'playing' }
    case 0xfc:
      return { ...state, transport: 'stopped', stops: state.stops + 1 }
    default:
      return state
  }
}

export interface TempoReading {
  bpm: number
  /** Largest minus smallest tick interval in the window, ms — how steady the clock is. */
  jitterMs: number
  /** Ticks the reading is based on. */
  ticks: number
}

/**
 * The tempo implied by the recent ticks, or null when there aren't enough, or
 * the last one is older than CLOCK_STALE_MS at `now`.
 */
export function tempoOf(state: ClockState, now: number): TempoReading | null {
  const t = state.ticks
  if (t.length < 7) return null // a quarter of a beat is the least worth quoting
  if (now - t[t.length - 1] > CLOCK_STALE_MS) return null
  const span = t[t.length - 1] - t[0]
  if (span <= 0) return null
  const interval = span / (t.length - 1)
  const gaps = t.slice(1).map((x, i) => x - t[i])
  return {
    bpm: Math.round((60000 / (interval * TICKS_PER_BEAT)) * 10) / 10,
    jitterMs: Math.round((Math.max(...gaps) - Math.min(...gaps)) * 10) / 10,
    ticks: t.length,
  }
}
