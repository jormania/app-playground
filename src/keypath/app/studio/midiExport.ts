import type { Recording } from './recorder'

// A take as a Standard MIDI File: format 0, one track, what she played on
// channel 1 with the sustain pedal. The writer's twin is engine/smf.ts's
// reader, which the tests read these files back with.
//
// Times go in at the take's count-in tempo when it had one: she started on
// the beat after four clicks, so a notation app draws her bars where she
// played them. Without a count-in, 120 BPM (the MIDI default): the timing is
// exact either way, only the bar lines are arbitrary.

export const PPQ = 480
export const DEFAULT_BPM = 120

function vlq(n: number): number[] {
  const out = [n & 0x7f]
  n >>>= 7
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80)
    n >>>= 7
  }
  return out
}
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
/** Track names are bytes; UTF-8 is what current notation apps read. */
const utf8 = (s: string) => Array.from(new TextEncoder().encode(s))

interface Ev {
  tick: number
  /** Order within a tick: note-offs and pedal-ups before note-ons, so a repeated key isn't cut. */
  order: number
  bytes: number[]
}

export function takeToSmf(r: Recording, { name, bpm = DEFAULT_BPM }: { name: string; bpm?: number }): Uint8Array {
  const tick = (ms: number) => Math.max(0, Math.round((ms * PPQ * bpm) / 60_000))
  const events: Ev[] = [
    ...r.notes.flatMap((n) => [
      { tick: tick(n.startMs), order: 2, bytes: [0x90, n.pitch & 0x7f, Math.max(1, Math.min(127, n.velocity))] },
      { tick: Math.max(tick(n.startMs) + 1, tick(n.startMs + n.durationMs)), order: 0, bytes: [0x80, n.pitch & 0x7f, 0] },
    ]),
    ...r.pedal.map((p) => ({ tick: tick(p.atMs), order: p.down ? 1 : 0, bytes: [0xb0, 64, p.down ? 127 : 0] })),
  ].sort((a, b) => a.tick - b.tick || a.order - b.order)

  const us = Math.round(60_000_000 / bpm)
  const title = utf8(name)
  const body: number[] = [
    ...[0, 0xff, 0x03, ...vlq(title.length), ...title],
    ...[0, 0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff],
    ...[0, 0xff, 0x58, 4, 4, 2, 24, 8],
  ]
  let at = 0
  for (const e of events) {
    body.push(...vlq(e.tick - at), ...e.bytes)
    at = e.tick
  }
  // End of track after the take's own end, so trailing silence survives.
  body.push(...vlq(Math.max(0, tick(r.ms) - at)), 0xff, 0x2f, 0)

  return new Uint8Array([...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ), ...ascii('MTrk'), ...u32(body.length), ...body])
}

/** "Ode to Joy, take 2" → "Ode-to-Joy-take-2.mid". Letters of any language kept; nothing a file system minds. */
export function midiFilename(name: string): string {
  const base = name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'KeyPath-take'}.mid`
}
