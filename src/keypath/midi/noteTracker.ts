import type { MidiEvent } from './types'

export interface HeldNote {
  note: number
  channel: number
  velocity: number
  onTime: number
}

export interface PlayedNote extends HeldNote {
  offTime: number
  durationMs: number
}

export interface TrackerState {
  held: HeldNote[]
  /** Most recent completed notes, newest first. */
  played: PlayedNote[]
  lastNoteOn: HeldNote | null
  lastPlayed: PlayedNote | null
  sustain: boolean
  counts: {
    noteOn: number
    noteOff: number
    zeroVelocityOffs: number
    cc: number
    realtime: Record<string, number>
    other: number
    /** Note Off for a key we never saw go down — a dropped Note On, or a key held across connect. */
    orphanOffs: number
    /** Note On for a key already down — a dropped Note Off. */
    doubleOns: number
    /** Events whose platform timestamp went backwards. Should stay 0. */
    outOfOrder: number
  }
  lowest: number | null
  highest: number | null
  velocities: { min: number; max: number } | null
  channels: number[]
  lastTime: number | null
}

export const emptyTracker = (): TrackerState => ({
  held: [],
  played: [],
  lastNoteOn: null,
  lastPlayed: null,
  sustain: false,
  counts: { noteOn: 0, noteOff: 0, zeroVelocityOffs: 0, cc: 0, realtime: {}, other: 0, orphanOffs: 0, doubleOns: 0, outOfOrder: 0 },
  lowest: null,
  highest: null,
  velocities: null,
  channels: [],
  lastTime: null,
})

const PLAYED_KEEP = 50
const key = (n: { note: number; channel: number }) => `${n.channel}:${n.note}`

/**
 * Pure reducer: held keys, completed notes with durations, and the integrity
 * counters the probe exists to watch. Duration is key-down to key-up; the
 * sustain pedal is tracked but deliberately not folded in — for a learning
 * app "how long did she hold the key" and "how long did it ring" are
 * different questions, and only the first is about her fingers.
 */
export function track(state: TrackerState, e: MidiEvent): TrackerState {
  const counts = { ...state.counts }
  const lastTime = state.lastTime
  if (e.type !== 'realtime' && lastTime !== null && e.time < lastTime) counts.outOfOrder++
  const nextTime = e.type === 'realtime' ? lastTime : Math.max(lastTime ?? e.time, e.time)

  switch (e.type) {
    case 'noteon': {
      counts.noteOn++
      const existing = state.held.find((h) => key(h) === key(e))
      if (existing) counts.doubleOns++
      const held: HeldNote = { note: e.note, channel: e.channel, velocity: e.velocity, onTime: e.time }
      const v = state.velocities
      return {
        ...state,
        counts,
        lastTime: nextTime,
        held: [...state.held.filter((h) => key(h) !== key(e)), held].sort((a, b) => a.note - b.note),
        lastNoteOn: held,
        lowest: state.lowest === null ? e.note : Math.min(state.lowest, e.note),
        highest: state.highest === null ? e.note : Math.max(state.highest, e.note),
        velocities: v ? { min: Math.min(v.min, e.velocity), max: Math.max(v.max, e.velocity) } : { min: e.velocity, max: e.velocity },
        channels: state.channels.includes(e.channel) ? state.channels : [...state.channels, e.channel].sort((a, b) => a - b),
      }
    }
    case 'noteoff': {
      counts.noteOff++
      if (e.viaZeroVelocity) counts.zeroVelocityOffs++
      const on = state.held.find((h) => key(h) === key(e))
      if (!on) {
        counts.orphanOffs++
        return { ...state, counts, lastTime: nextTime }
      }
      const played: PlayedNote = { ...on, offTime: e.time, durationMs: e.time - on.onTime }
      return {
        ...state,
        counts,
        lastTime: nextTime,
        held: state.held.filter((h) => key(h) !== key(e)),
        played: [played, ...state.played].slice(0, PLAYED_KEEP),
        lastPlayed: played,
      }
    }
    case 'cc':
      counts.cc++
      return {
        ...state,
        counts,
        lastTime: nextTime,
        sustain: e.controller === 64 ? e.value >= 64 : state.sustain,
      }
    case 'realtime': {
      const name = e.status.toString(16).toUpperCase()
      counts.realtime = { ...counts.realtime, [name]: (counts.realtime[name] ?? 0) + 1 }
      return { ...state, counts }
    }
    default:
      counts.other++
      return { ...state, counts, lastTime: nextTime }
  }
}
