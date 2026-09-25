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

/**
 * Both hands in one track, as many piano files come: [pitch, startBeat, beats]
 * triples, notes free to overlap, at `bpm`, 480 ticks per quarter.
 */
export function pianoFile(notes: [number, number, number][], { bpm = 120, channel = 1, name = 'Piano', beatsPerBar = 4 } = {}): Uint8Array {
  const timed: { at: number; off: boolean; pitch: number }[] = []
  for (const [pitch, start, beats] of notes) {
    timed.push({ at: Math.round(start * 480), off: false, pitch }, { at: Math.round((start + beats) * 480), off: true, pitch })
  }
  // At the same moment, a note ends before the next one starts.
  timed.sort((a, b) => a.at - b.at || Number(b.off) - Number(a.off))
  const events: TrackEvent[] = [meta.name(0, name), meta.tempo(0, bpm), meta.timeSig(0, beatsPerBar, 4)]
  let now = 0
  for (const e of timed) {
    events.push(e.off ? off(e.at - now, channel, e.pitch) : on(e.at - now, channel, e.pitch))
    now = e.at
  }
  return smf(0, 480, [track(events)])
}

/**
 * Eight bars in the manner of a slow waltz for piano (bass note, then a chord,
 * and a melody above): the left hand's chords rise past middle C, to F sharp.
 */
export const waltzPiano = (): [number, number, number][] => {
  const melody = [78, 81, 79, 78, 76, 74, 76, 74]
  return melody.flatMap((m, bar): [number, number, number][] => {
    const b = bar * 3
    const [bass, chord] = bar % 2 ? [38, [57, 61, 66]] : [43, [59, 62, 66]]
    return [[bass, b, 1], ...chord.map((p): [number, number, number] => [p, b + 1, 2]), [m, b + 1, 2]]
  })
}
