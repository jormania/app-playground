// A Standard MIDI File reader: formats 0 and 1, the ones every notation app,
// DAW and download site produces. No dependency — the format is small, fixed
// since 1988, and this reads only what the tutor needs: notes, tempo, time
// signature and track names.

import type { Finger } from './song'

export interface SmfNote {
  track: number
  /** 1–16. */
  channel: number
  pitch: number
  velocity: number
  startTick: number
  endTick: number
  startMs: number
  endMs: number
  /** Set from a score (engine/musicxml.ts): its bar, 0-based in playing order, repeats written out. */
  bar?: number
  /** Set from a score that prints one: the finger that plays it. */
  finger?: Finger
}

export interface SmfTrack {
  index: number
  name: string
}

export interface TempoChange {
  tick: number
  /** Microseconds per quarter note, as stored. */
  usPerQuarter: number
}

export interface TimeSignature {
  tick: number
  numerator: number
  denominator: number
}

export interface SmfFile {
  format: 0 | 1
  ticksPerQuarter: number
  tracks: SmfTrack[]
  notes: SmfNote[]
  tempos: TempoChange[]
  timeSignatures: TimeSignature[]
  /** Set when the file is a MusicXML score rather than MIDI (engine/musicxml.ts). */
  score?: ScoreInfo
}

/** What a score says that MIDI can't. */
export interface ScoreInfo {
  title: string
  /** The printed number of each bar, in playing order: a repeat's bars come round again under their own numbers. */
  barLabels: string[]
  /** Each part (by `track:channel`, the channel being the staff): its instrument, its staff, and how many staves the instrument has. */
  parts: Record<string, { name: string; staff: number; staves: number }>
}

export class SmfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmfError'
  }
}

const DEFAULT_US_PER_QUARTER = 500_000 // 120 BPM, the MIDI default

class Reader {
  pos = 0
  constructor(
    private readonly bytes: Uint8Array,
    private readonly end = bytes.length,
  ) {}

  get done() {
    return this.pos >= this.end
  }
  u8(): number {
    if (this.pos >= this.end) throw new SmfError('Unexpected end of data')
    return this.bytes[this.pos++]
  }
  u16(): number {
    return (this.u8() << 8) | this.u8()
  }
  u32(): number {
    return ((this.u8() << 24) >>> 0) + (this.u8() << 16) + (this.u8() << 8) + this.u8()
  }
  ascii(n: number): string {
    let s = ''
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8())
    return s
  }
  /** Variable-length quantity: 7 bits per byte, high bit = more follows. At most 4 bytes. */
  vlq(): number {
    let value = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      value = (value << 7) | (b & 0x7f)
      if (!(b & 0x80)) return value
    }
    throw new SmfError('Malformed variable-length quantity')
  }
  skip(n: number) {
    if (this.pos + n > this.end) throw new SmfError('Unexpected end of data')
    this.pos += n
  }
}

interface RawNoteOn {
  tick: number
  velocity: number
}

export function parseSmf(data: ArrayBuffer | Uint8Array): SmfFile {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const r = new Reader(bytes)
  if (bytes.length < 14 || r.ascii(4) !== 'MThd') throw new SmfError('Not a MIDI file (no MThd header)')
  const headerLength = r.u32()
  const format = r.u16()
  const trackCount = r.u16()
  const division = r.u16()
  r.skip(headerLength - 6)
  if (format === 2) throw new SmfError('MIDI format 2 (independent patterns) is not supported')
  if (format !== 0 && format !== 1) throw new SmfError(`Unknown MIDI format ${format}`)
  if (division & 0x8000) throw new SmfError('SMPTE-timed MIDI files are not supported')
  const ticksPerQuarter = division

  const tracks: SmfTrack[] = []
  const tempos: TempoChange[] = []
  const timeSignatures: TimeSignature[] = []
  const pending: Omit<SmfNote, 'startMs' | 'endMs'>[] = []

  for (let t = 0; t < trackCount && !r.done; t++) {
    const id = r.ascii(4)
    const length = r.u32()
    if (id !== 'MTrk') {
      r.skip(length) // unknown chunk: the spec says skip it
      t--
      continue
    }
    const end = r.pos + length
    const tr = new Reader(bytes, Math.min(end, bytes.length))
    tr.pos = r.pos
    const track: SmfTrack = { index: tracks.length, name: '' }
    // Per channel+pitch, a queue of sounding notes: the same key can be struck
    // again before its release arrives, and the first off closes the first on.
    const open = new Map<number, RawNoteOn[]>()
    let tick = 0
    let running = 0

    while (!tr.done) {
      tick += tr.vlq()
      let status = tr.u8()
      if (status < 0x80) {
        // Running status: this byte is data, reuse the last channel status.
        if (!running) throw new SmfError('Running status with no previous status')
        tr.pos--
        status = running
      }

      if (status === 0xff) {
        const type = tr.u8()
        const len = tr.vlq()
        const start = tr.pos
        if (type === 0x03 && !track.name) track.name = tr.ascii(len).trim()
        else if (type === 0x51 && len === 3) tempos.push({ tick, usPerQuarter: (tr.u8() << 16) | (tr.u8() << 8) | tr.u8() })
        else if (type === 0x58 && len >= 2) timeSignatures.push({ tick, numerator: tr.u8(), denominator: 2 ** tr.u8() })
        tr.pos = start + len
        if (type === 0x2f) break
        continue
      }
      if (status === 0xf0 || status === 0xf7) {
        tr.skip(tr.vlq()) // SysEx: not needed
        continue
      }
      if (status >= 0xf0) throw new SmfError(`Unexpected status 0x${status.toString(16)} in track`)

      running = status
      const kind = status & 0xf0
      const channel = (status & 0x0f) + 1
      const d1 = tr.u8()
      const d2 = kind === 0xc0 || kind === 0xd0 ? 0 : tr.u8()
      const key = channel * 128 + d1

      if (kind === 0x90 && d2 > 0) {
        const q = open.get(key) ?? []
        q.push({ tick, velocity: d2 })
        open.set(key, q)
      } else if (kind === 0x80 || kind === 0x90) {
        const on = open.get(key)?.shift()
        if (on) pending.push({ track: track.index, channel, pitch: d1, velocity: on.velocity, startTick: on.tick, endTick: tick })
      }
    }
    // Notes never released: end them where the track ends.
    for (const [key, q] of open) {
      for (const on of q) {
        pending.push({ track: track.index, channel: Math.floor(key / 128), pitch: key % 128, velocity: on.velocity, startTick: on.tick, endTick: Math.max(tick, on.tick) })
      }
    }
    tracks.push(track)
    r.pos = end
  }

  tempos.sort((a, b) => a.tick - b.tick)
  timeSignatures.sort((a, b) => a.tick - b.tick)
  const toMs = tickToMs(tempos, ticksPerQuarter)
  const notes = pending
    .map((n) => ({ ...n, startMs: toMs(n.startTick), endMs: toMs(n.endTick) }))
    .sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)

  return { format, ticksPerQuarter, tracks, notes, tempos, timeSignatures }
}

/** Build a tick → milliseconds converter from the tempo map (format 1 keeps it in track 0, but any track may carry changes). */
export function tickToMs(tempos: readonly TempoChange[], ticksPerQuarter: number): (tick: number) => number {
  const segments: { tick: number; ms: number; usPerQuarter: number }[] = [{ tick: 0, ms: 0, usPerQuarter: DEFAULT_US_PER_QUARTER }]
  for (const t of tempos) {
    const last = segments[segments.length - 1]
    const ms = last.ms + ((t.tick - last.tick) * last.usPerQuarter) / ticksPerQuarter / 1000
    if (t.tick === last.tick) segments[segments.length - 1] = { ...last, usPerQuarter: t.usPerQuarter }
    else segments.push({ tick: t.tick, ms, usPerQuarter: t.usPerQuarter })
  }
  return (tick) => {
    let s = segments[0]
    for (const seg of segments) {
      if (seg.tick > tick) break
      s = seg
    }
    return s.ms + ((tick - s.tick) * s.usPerQuarter) / ticksPerQuarter / 1000
  }
}
