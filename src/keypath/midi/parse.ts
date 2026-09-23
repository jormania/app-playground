import type { MidiEvent, MidiSourceKind } from './types'

export interface ParseContext {
  time: number
  receivedAt: number
  source: MidiSourceKind
  deviceId: string
}

// System real-time bytes (F8–FF). The PSR-E383's implementation chart says it
// transmits Clock (F8) and start/stop (FA/FC) while a Style plays, and Active
// Sensing (FE) — a keep-alive a few times a second. None are key presses.
const isRealtime = (status: number) => status >= 0xf8

/**
 * Decode one MIDI message. Web MIDI hands over exactly one complete message
 * per `midimessage` event (running status already expanded), so this never
 * has to deal with a byte stream.
 *
 * The rule that matters most: a Note On with velocity 0 IS a Note Off. The
 * Yamaha's chart lists its Note Off as `9nH, v=0` and never sends 8nH, so a
 * parser that only looked for 0x80 would see every key held down forever.
 */
export function parseMidiMessage(data: ArrayLike<number>, ctx: ParseContext): MidiEvent | null {
  if (data.length === 0) return null
  const status = data[0]
  const base = { time: ctx.time, receivedAt: ctx.receivedAt, source: ctx.source, deviceId: ctx.deviceId }

  if (isRealtime(status)) return { ...base, type: 'realtime', status }
  if (status < 0x80) return null // stray data byte — nothing to anchor it to

  const kind = status & 0xf0
  const channel = (status & 0x0f) + 1
  const d1 = data[1] ?? 0
  const d2 = data[2] ?? 0

  switch (kind) {
    case 0x90:
      return d2 === 0
        ? { ...base, type: 'noteoff', channel, note: d1, velocity: 0, viaZeroVelocity: true }
        : { ...base, type: 'noteon', channel, note: d1, velocity: d2 }
    case 0x80:
      return { ...base, type: 'noteoff', channel, note: d1, velocity: d2, viaZeroVelocity: false }
    case 0xb0:
      return { ...base, type: 'cc', channel, controller: d1, value: d2 }
    case 0xc0:
      return { ...base, type: 'program', channel, program: d1 }
    default:
      return { ...base, type: 'other', data: Array.from(data) }
  }
}

/** Human-readable one-liner for an `other` or `realtime` event. */
export function describeRaw(data: ArrayLike<number>): string {
  return Array.from(data, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

export const REALTIME_NAMES: Record<number, string> = {
  0xf8: 'Clock',
  0xfa: 'Start',
  0xfb: 'Continue',
  0xfc: 'Stop',
  0xfe: 'Active Sensing',
  0xff: 'Reset',
}
