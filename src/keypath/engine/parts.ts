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
  /** From a score: which staff of its instrument this is (1 the top), of how many. */
  staff?: number
  staves?: number
}

const partKey = (n: Pick<SmfNote, 'track' | 'channel'>) => `${n.track}:${n.channel}`

export function partsOf(file: SmfFile): Part[] {
  const byKey = new Map<string, SmfNote[]>()
  for (const n of file.notes) byKey.set(partKey(n), [...(byKey.get(partKey(n)) ?? []), n])
  return [...byKey.entries()]
    .map(([key, notes]) => {
      const pitches = notes.map((n) => n.pitch)
      const { track, channel } = notes[0]
      const scored = file.score?.parts[key]
      return {
        key,
        track,
        channel,
        name: scored?.name || file.tracks[track]?.name || `Track ${track + 1}`,
        ...(scored ? { staff: scored.staff, staves: scored.staves } : {}),
        noteCount: notes.length,
        low: Math.min(...pitches),
        high: Math.max(...pitches),
        meanPitch: pitches.reduce((a, b) => a + b, 0) / pitches.length,
        // A score's channel is its staff, and its percussion never reaches here.
        isDrums: !scored && channel === 10,
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
  // A score says its bars (a pickup, a change of metre, repeats written out); MIDI's are counted from the metre.
  const firstBar = chosen.length && chosen.every((n) => n.bar !== undefined) ? Math.min(...chosen.map((n) => n.bar!)) : null

  const notes: SongNote[] = chosen.map((n, i) => ({
    id: i,
    pitch: n.pitch + shift,
    startMs: n.startMs - firstMs,
    durationMs: Math.max(1, n.endMs - n.startMs),
    hand: handOf.get(partKey(n))!,
    bar: firstBar !== null ? n.bar! - firstBar : Math.floor((n.startTick - barOffsetTicks) / ticksPerBar),
    ...(n.finger ? { finger: n.finger } : {}),
  }))
  const usPerQuarter = file.tempos[0]?.usPerQuarter ?? 500_000
  return {
    id: opts.id,
    title: opts.title,
    notes,
    bpm: Math.round(60_000_000 / usPerQuarter),
    beatsPerBar,
    durationMs: notes.length ? Math.max(...notes.map((n) => n.startMs + n.durationMs)) : 0,
    ...(file.score && firstBar !== null ? { barLabels: file.score.barLabels.slice(firstBar) } : {}),
  }
}

/**
 * For a score: the hands as printed, the top staff of a keyboard instrument
 * to the right hand and the one below to the left (the busiest such
 * instrument, if there are several). Otherwise the guess for MIDI.
 */
export function suggestScoreParts(parts: readonly Part[]): { right: Part | null; left: Part | null } {
  const byInstrument = new Map<number, Part[]>()
  for (const p of parts) if (p.staves && p.staves > 1) byInstrument.set(p.track, [...(byInstrument.get(p.track) ?? []), p])
  const keyboards = [...byInstrument.values()].filter((ps) => ps.some((p) => p.staff === 1) && ps.some((p) => p.staff === 2))
  if (keyboards.length === 0) return suggestParts(parts)
  const busiest = keyboards.reduce((a, b) => (b.reduce((s, p) => s + p.noteCount, 0) > a.reduce((s, p) => s + p.noteCount, 0) ? b : a))
  return { right: busiest.find((p) => p.staff === 1)!, left: busiest.find((p) => p.staff === 2)! }
}

// ── One part, two hands ─────────────────────────────────────────────────────
// Many piano files keep both hands in one track. Split by pitch: below the
// split point to the left hand, from it up to the right. A plain line can't
// follow hands that cross, so it is offered, previewed, and movable.

/** Split points offered: F3 to C5, around middle C. */
export const SPLIT_RANGE = { low: 53, high: 72 } as const
const MIDDLE_C = 60

/**
 * Whether a part looks like both hands at once, and if so where to split it.
 * Two hands show as notes on both sides of middle C and many notes starting
 * together; a melody alone has neither. The point chosen cuts the fewest
 * chords (notes sounding together a fifth or less apart) and leaves neither
 * hand holding notes more than an octave apart, nearest middle C when that
 * ties: a bass-and-chords left hand keeps its chords, the melody goes right.
 */
export function suggestSplit(notes: readonly Pick<SongNote, 'pitch' | 'startMs'>[]): number | null {
  if (notes.length < 8) return null
  const below = notes.filter((n) => n.pitch < MIDDLE_C).length / notes.length
  const above = 1 - below
  const starts = new Map<number, number>()
  for (const n of notes) starts.set(Math.round(n.startMs / 30), (starts.get(Math.round(n.startMs / 30)) ?? 0) + 1)
  const together = notes.filter((n) => (starts.get(Math.round(n.startMs / 30)) ?? 0) > 1).length / notes.length
  if (below < 0.15 || above < 0.15 || together < 0.15) return null
  // Notes sounding together, lowest first. A line between two of them a fifth
  // or less apart would cut what one hand plays (a chord); and one hand can't
  // hold notes more than an octave apart at once. Hands part at a wide gap.
  const byStart = new Map<number, number[]>()
  for (const n of notes) byStart.set(Math.round(n.startMs / 30), [...(byStart.get(Math.round(n.startMs / 30)) ?? []), n.pitch])
  const groups = [...byStart.values()].map((g) => g.sort((x, y) => x - y))
  const reach = (ps: number[]) => (ps.length > 1 && ps[ps.length - 1] - ps[0] > 12 ? 1 : 0)
  const cost = (at: number) =>
    groups.reduce((sum, g) => {
      const cut = g.some((p, i) => i > 0 && g[i - 1] < at && p >= at && p - g[i - 1] <= 7) ? 1 : 0
      return sum + cut + reach(g.filter((p) => p < at)) + reach(g.filter((p) => p >= at))
    }, 0)
  let best = MIDDLE_C
  let bestCost = Infinity
  for (let at = SPLIT_RANGE.low; at <= SPLIT_RANGE.high; at++) {
    const left = notes.filter((n) => n.pitch < at).length
    if (left === 0 || left === notes.length) continue
    // Nearest middle C breaks ties.
    const c = cost(at) + Math.abs(at - MIDDLE_C) * 0.01
    if (c < bestCost) {
      bestCost = c
      best = at
    }
  }
  return best
}

/** Give a song's notes to the hands by pitch: below `at` the left hand, from `at` up the right. */
export function splitHands(song: Song, at: number): Song {
  return { ...song, notes: song.notes.map((n): SongNote => ({ ...n, hand: n.pitch < at ? 'left' : 'right' })) }
}
