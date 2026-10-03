import type { Finger, Practice, Song, SongNote } from '../../engine'

// Read and play (door C): a short piece is written on the staff, made up on
// the spot so it can't be played from memory, and she plays it reading it,
// the keys dark until she is stuck. Five pieces to a round, a point for each
// played without a wrong key. The notes are the ones the Journey teaches on
// the staff: the C position ("Reading music"), up to the C above
// ("Reading higher"), and the left hand's C position for the bass.

export type ReadLevel = 1 | 2 | 3

export const READ_ROUND = 5
/** One beat a second: the strip draws lengths from it, and nothing runs on a clock. */
export const READ_BEAT_MS = 1000

/** A hand position: the five keys of the right hand, thumb first, and the left hand's two bass notes (home, then the fifth). */
interface Position {
  right: readonly [number, number, number, number, number]
  bass: readonly [number, number]
}
/** Right thumb on middle C; the left hand an octave down, C or G. */
const C_POSITION: Position = { right: [60, 62, 64, 65, 67], bass: [48, 55] }
/** Right thumb on G; the left hand's G and D. */
const G_POSITION: Position = { right: [67, 69, 71, 72, 74], bass: [55, 50] }

/** The left hand in the C position (little finger on C3): the finger on each of its bass notes. */
const LEFT_FINGER: Record<number, Finger> = { 48: 5, 50: 4, 55: 1 }

interface LevelSpec {
  positions: readonly Position[]
  bars: number
  /** How far the tune may move from one note to the next, in keys of the position. */
  reach: number
  /** Beats in a bar, one pattern per bar; the last bar takes one of `endings`. */
  rhythms: readonly (readonly number[])[]
  endings: readonly (readonly number[])[]
  practice: Practice
}

/**
 * Level 1: the C position, step by step, in quarter notes; two bars.
 * Level 2: the C or G position, skips of a third, half notes too; three bars.
 * Level 3: both hands, the left a note a bar; skips up to a fifth, pairs of eighths; four bars.
 */
export const LEVELS: Record<ReadLevel, LevelSpec> = {
  1: { positions: [C_POSITION], bars: 2, reach: 1, rhythms: [[1, 1, 1, 1]], endings: [[1, 1, 2]], practice: 'right' },
  2: {
    positions: [C_POSITION, G_POSITION],
    bars: 3,
    reach: 2,
    rhythms: [[1, 1, 1, 1], [1, 1, 2], [2, 1, 1], [1, 2, 1], [2, 2]],
    endings: [[1, 1, 2], [2, 2]],
    practice: 'right',
  },
  3: {
    positions: [C_POSITION, G_POSITION],
    bars: 4,
    reach: 4,
    rhythms: [[1, 1, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 0.5, 0.5, 1]],
    endings: [[1, 1, 2], [2, 2], [4]],
    practice: 'both',
  },
}

/** How often the tune moves by each number of keys (0 = the same key again): mostly steps. */
const MOVE_WEIGHT = [1, 4, 2, 1, 1]

const pick = <T,>(xs: readonly T[], random: () => number): T => xs[Math.min(xs.length - 1, Math.floor(random() * xs.length))]

/**
 * The next key in the position (0–4): at most `reach` away, the same key never
 * three times running, and never further from home (0) than the notes left can
 * walk back, so the tune ends on its home key without a leap.
 */
function nextIndex(at: number, reach: number, random: () => number, repeated: boolean, left: number): number {
  const moves: number[] = []
  for (const allowRepeat of [false, true]) {
    for (let d = -reach; d <= reach; d++) {
      const to = at + d
      if (to < 0 || to > 4 || to > reach * left || (d === 0 && repeated && !allowRepeat)) continue
      for (let w = 0; w < MOVE_WEIGHT[Math.abs(d)]; w++) moves.push(to)
    }
    if (moves.length) break
  }
  return pick(moves, random)
}

export interface ReadPiece {
  song: Song
  practice: Practice
}

/** A piece for this level, new each time: the tune ends on the position's home key, the bass on its home note. */
export function pieceFor(level: ReadLevel, random: () => number = Math.random, n = 1): ReadPiece {
  const spec = LEVELS[level]
  const pos = pick(spec.positions, random)
  const rhythm = Array.from({ length: spec.bars }, (_, b) => pick(b === spec.bars - 1 ? spec.endings : spec.rhythms, random))
  const count = rhythm.reduce((sum, r) => sum + r.length, 0)

  // The keys of the tune, as places in the position: a walk from the thumb (or the middle), home at the end.
  const at: number[] = [pick((level === 1 ? [0, 2] : [0, 2, 4]).filter((i) => i <= spec.reach * (count - 1)), random)]
  for (let i = 1; i < count; i++) at.push(nextIndex(at[i - 1], spec.reach, random, i >= 2 && at[i - 1] === at[i - 2], count - 1 - i))

  const notes: SongNote[] = []
  let k = 0
  let beat = 0
  rhythm.forEach((bar, b) => {
    for (const beats of bar) {
      const index = at[k++]
      notes.push({ id: notes.length, pitch: pos.right[index], startMs: beat * READ_BEAT_MS, durationMs: beats * READ_BEAT_MS * 0.95, hand: 'right', bar: b, finger: (index + 1) as Finger })
      beat += beats
    }
  })
  if (spec.practice === 'both') {
    for (let b = 0; b < spec.bars; b++) {
      // Home, the fifth, home …, and home again at the end.
      const pitch = b === spec.bars - 1 || b % 2 === 0 ? pos.bass[0] : pos.bass[1]
      notes.push({ id: notes.length, pitch, startMs: b * 4 * READ_BEAT_MS, durationMs: 4 * READ_BEAT_MS * 0.95, hand: 'left', bar: b, finger: LEFT_FINGER[pitch] })
    }
  }
  notes.sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
  const durationMs = Math.max(...notes.map((x) => x.startMs + x.durationMs))
  return { song: { id: `read:${level}:${n}`, title: `${n}`, notes, bpm: 60, beatsPerBar: 4, durationMs }, practice: spec.practice }
}

/** Every key a level can ask for, so the keyboard drawn stays the same for the whole round. */
export const levelPitches = (level: ReadLevel): number[] => LEVELS[level].positions.flatMap((p) => [...p.right, ...(LEVELS[level].practice === 'both' ? p.bass : [])])
