// Builds Standard MIDI Files byte by byte for tests. Deliberately low-level, so
// a test can produce exactly the awkward cases real files contain (running
// status, Note On velocity 0 as Note Off, tempo changes, unknown chunks).

export type TrackEvent =
  | { dt: number; raw: number[] } // a channel message or anything else, written as given
  | { dt: number; meta: number; data: number[] }

export function vlq(n: number): number[] {
  const out = [n & 0x7f]
  n >>= 7
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80)
    n >>= 7
  }
  return out
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

export function track(events: TrackEvent[], { endOfTrack = true } = {}): number[] {
  const body: number[] = []
  for (const e of events) {
    body.push(...vlq(e.dt))
    if ('raw' in e) body.push(...e.raw)
    else body.push(0xff, e.meta, ...vlq(e.data.length), ...e.data)
  }
  if (endOfTrack) body.push(0, 0xff, 0x2f, 0)
  return [...ascii('MTrk'), ...u32(body.length), ...body]
}

export function smf(format: 0 | 1, ticksPerQuarter: number, tracks: number[][], extraChunks: number[][] = []): Uint8Array {
  return new Uint8Array([
    ...ascii('MThd'),
    ...u32(6),
    ...u16(format),
    ...u16(tracks.length),
    ...u16(ticksPerQuarter),
    ...extraChunks.flat(),
    ...tracks.flat(),
  ])
}

export const meta = {
  name: (dt: number, s: string): TrackEvent => ({ dt, meta: 0x03, data: ascii(s) }),
  tempo: (dt: number, bpm: number): TrackEvent => {
    const us = Math.round(60_000_000 / bpm)
    return { dt, meta: 0x51, data: [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff] }
  },
  timeSig: (dt: number, num: number, den: number): TrackEvent => ({ dt, meta: 0x58, data: [num, Math.log2(den), 24, 8] }),
}

export const on = (dt: number, ch: number, pitch: number, vel = 80): TrackEvent => ({ dt, raw: [0x90 | (ch - 1), pitch, vel] })
export const off = (dt: number, ch: number, pitch: number): TrackEvent => ({ dt, raw: [0x80 | (ch - 1), pitch, 0] })

/** A one-voice melody on one track: [pitch, beats] pairs, at `bpm`, 480 ticks per quarter. */
export function melodyFile(notes: [number, number][], { bpm = 120, channel = 1, name = 'Melody' } = {}): Uint8Array {
  const events: TrackEvent[] = [meta.name(0, name), meta.tempo(0, bpm), meta.timeSig(0, 4, 4)]
  for (const [pitch, beats] of notes) {
    events.push(on(0, channel, pitch))
    events.push(off(beats * 480, channel, pitch))
  }
  return smf(0, 480, [track(events)])
}
