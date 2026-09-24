import type { SmfFile, SmfNote } from './smf'
import type { Hand, Song, SongNote } from './song'

/** One instrument line in a file: a track+channel pair with notes. */
export interface Part {
  key: string
  track: number
  channel: number
  name: string
  noteCount: number
  low: number
  high: number
  /** Mean pitch — the usual tell between melody (high) and bass (low). */
  meanPitch: number
  /** GM channel 10 is percussion: never a part to learn. */
  isDrums: boolean
}

const partKey = (n: Pick<SmfNote, 'track' | 'channel'>) => `${n.track}:${n.channel}`

export function partsOf(file: SmfFile): Part[] {
  const byKey = new Map<string, SmfNote[]>()
  for (const n of file.notes) byKey.set(partKey(n), [...(byKey.get(partKey(n)) ?? []), n])
  return [...byKey.entries()]
    .map(([key, notes]) => {
      const pitches = notes.map((n) => n.pitch)
      const { track, channel } = notes[0]
      return {
        key,
        track,
        channel,
        name: file.tracks[track]?.name || `Track ${track + 1}`,
        noteCount: notes.length,
        low: Math.min(...pitches),
        high: Math.max(...pitches),
        meanPitch: pitches.reduce((a, b) => a + b, 0) / pitches.length,
        isDrums: channel === 10,
      }
    })
    .sort((a, b) => a.track - b.track || a.channel - b.channel)
}

const PIANO = /piano|klavier|keys|melod|lead|right|\brh\b|dreapta|mâna/i
const LEFT = /left|\blh\b|bass|stâng/i

/**
 * A first guess at what to learn, for the "Which part?" step — the person
 * always confirms. Named piano/melody parts first; otherwise the busiest
 * non-drum part. If a clearly lower part is named as left hand/bass, it's
 * offered as the left hand.
 */
export function suggestParts(parts: readonly Part[]): { right: Part | null; left: Part | null } {
  const playable = parts.filter((p) => !p.isDrums)
  if (playable.length === 0) return { right: null, left: null }
  const named = playable.filter((p) => PIANO.test(p.name) && !LEFT.test(p.name))
  const right = (named.length ? named : playable).reduce((a, b) => (b.noteCount > a.noteCount ? b : a))
  const leftCandidates = playable.filter((p) => p !== right && LEFT.test(p.name) && p.meanPitch < right.meanPitch)
  const left = leftCandidates.length ? leftCandidates.reduce((a, b) => (b.noteCount > a.noteCount ? b : a)) : null
  return { right, left }
}

export interface SongFromPartsOptions {
  id: string
  title: string
  right: Part | null
  left: Part | null
  /** Semitones to move everything by; see range.ts. */
  transpose?: number
}

export function songFromParts(file: SmfFile, opts: SongFromPartsOptions): Song {
  const handOf = new Map<string, Hand>()
  if (opts.right) handOf.set(opts.right.key, 'right')
  if (opts.left) handOf.set(opts.left.key, 'left')
  const beatsPerBar = file.timeSignatures[0]?.numerator ?? 4
  const beatUnit = file.timeSignatures[0]?.denominator ?? 4
  const ticksPerBar = file.ticksPerQuarter * beatsPerBar * (4 / beatUnit)
  const shift = opts.transpose ?? 0

  const chosen = file.notes.filter((n) => handOf.has(partKey(n)))
  // The song starts at its first chosen note, not at an empty intro or the
  // other instruments' opening; bars count from the bar that note is in.
  const firstMs = chosen.length ? Math.min(...chosen.map((n) => n.startMs)) : 0
  const firstTick = chosen.length ? Math.min(...chosen.map((n) => n.startTick)) : 0
  const barOffsetTicks = Math.floor(firstTick / ticksPerBar) * ticksPerBar

  const notes: SongNote[] = chosen.map((n, i) => ({
    id: i,
    pitch: n.pitch + shift,
    startMs: n.startMs - firstMs,
    durationMs: Math.max(1, n.endMs - n.startMs),
    hand: handOf.get(partKey(n))!,
    bar: Math.floor((n.startTick - barOffsetTicks) / ticksPerBar),
  }))
  const usPerQuarter = file.tempos[0]?.usPerQuarter ?? 500_000
  return {
    id: opts.id,
    title: opts.title,
    notes,
    bpm: Math.round(60_000_000 / usPerQuarter),
    beatsPerBar,
    durationMs: notes.length ? Math.max(...notes.map((n) => n.startMs + n.durationMs)) : 0,
  }
}
