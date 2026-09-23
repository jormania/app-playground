import { noteName } from '../midi/noteNames'
import { summarise } from '../midi/timing'
import type { MidiEvent } from '../midi/types'
import type { EnvironmentFacts } from './environment'
import type { ProbeSnapshot } from './probeSession'
import type { UsbFinding } from './usb'

const round = (x: number) => Math.round(x * 100) / 100

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
export function buildReport(s: ProbeSnapshot, env: EnvironmentFacts | null, usb: UsbFinding | null) {
  const t = s.tracker
  return {
    keypathProbe: 1,
    takenAt: new Date().toISOString(),
    source: s.sourceKind,
    environment: env,
    usb,
    midi: {
      access: s.connection.access,
      error: s.connection.error,
      inputs: s.connection.inputs,
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
