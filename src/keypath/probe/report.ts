import { noteName } from '../midi/noteNames'
import { summarise } from '../midi/timing'
import type { MidiEvent } from '../midi/types'
import type { EnvironmentFacts } from './environment'
import type { ProbeSnapshot } from './probeSession'
import type { UsbFinding } from './usb'
import type { AudioDeviceView, HeardFrom, ToneResult } from './audioRouting'
import type { OutputLevel } from './outputLevel'

export interface AudioFindings {
  heard: HeardFrom | null
  tone: ToneResult | null
  devices: AudioDeviceView | null
  deviceChanges: number
  keyboardOutput: OutputLevel
}

const round = (x: number) => Math.round(x * 100) / 100

/** How many times an input that was connected went away. */
export function countDrops(history: readonly { inputs: string[] }[]): number {
  let drops = 0
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].inputs.some((name) => !history[i].inputs.includes(name))) drops++
  }
  return drops
}

function eventRow(e: MidiEvent, origin: number) {
  const t = round(e.time - origin)
  switch (e.type) {
    case 'noteon':
      return { t, type: 'on', ch: e.channel, note: noteName(e.note), midi: e.note, vel: e.velocity, lag: round(e.receivedAt - e.time) }
    case 'noteoff':
      return { t, type: 'off', ch: e.channel, note: noteName(e.note), midi: e.note, vel: e.velocity, zeroVelOn: e.viaZeroVelocity }
    case 'cc':
      return { t, type: 'cc', ch: e.channel, cc: e.controller, value: e.value }
    case 'program':
      return { t, type: 'program', ch: e.channel, program: e.program }
    case 'other':
      return { t, type: 'other', data: e.data }
    default:
      return { t, type: 'realtime', status: e.status }
  }
}

/**
 * Everything the probe learned, as one JSON document the owner can paste back
 * into the conversation or attach to KEYPATH.md. No personal data beyond the
 * browser's user agent and phone model; no content.
 */
export function buildReport(s: ProbeSnapshot, env: EnvironmentFacts | null, usb: UsbFinding | null, audio: AudioFindings | null = null) {
  const t = s.tracker
  return {
    keypathProbe: 1,
    takenAt: new Date().toISOString(),
    source: s.sourceKind,
    environment: env,
    usb,
    audio,
    midi: {
      access: s.connection.access,
      error: s.connection.error,
      inputs: s.connection.inputs,
      history: s.connectionHistory.map((c) => ({ t: round(c.time - s.origin), inputs: c.inputs })),
      drops: countDrops(s.connectionHistory),
    },
    observed: {
      counts: t.counts,
      channels: t.channels,
      range: t.lowest === null ? null : { lowest: noteName(t.lowest), highest: noteName(t.highest!) },
      velocity: t.velocities,
      stuckNow: t.held.map((h) => noteName(h.note)),
    },
    timingMs: {
      dispatchLag: summarise(s.dispatchLag),
      eventToNextFrame: summarise(s.toFrame),
    },
    tests: s.results,
    recentEvents: [...s.log].reverse().slice(-200).map((e) => eventRow(e, s.origin)),
  }
}
