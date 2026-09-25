import type { Song, SongNote } from '../../engine'

// How hard a song is, 1 to 3, for the song list and "Try next". The starter
// pack says so itself; an added song is rated from what its notes ask of the
// hands, the same things the starter levels were set by (KEYPATH_TUTOR.md §9,
// "How hard, how long, how many hands"). The rating is checked against the
// starter pack: rated with its levels hidden, every starter song comes out
// at its own level (level.test.ts). She can set another; that is kept.

export type Level = 1 | 2 | 3

const BLACK = new Set([1, 3, 6, 8, 10])
/** Notes struck within this of each other are one chord. */
const TOGETHER_MS = 40
/** Quicker than about three notes a second. */
const QUICK_MS = 320
/** Quicker than five a second. */
const VERY_QUICK_MS = 200
/** A share of a hand's notes that counts: a few quick grace notes don't. */
const SOME = 0.05
/** A sixth: a child's hand reaches it without moving. */
const IN_HAND = 9

/** What one hand is asked to do. */
interface HandLoad {
  notes: number
  /** Lowest to highest key, in semitones. */
  range: number
  /** The widest jump from one note (or chord) to the next: the top note for the right hand, the bottom for the left. */
  leap: number
  /** Shares of the gaps between one note and the next that are quick, and very quick. */
  quick: number
  veryQuick: number
  /** Share of its notes that come as chords. */
  chords: number
}

function handLoad(notes: readonly SongNote[], hand: 'left' | 'right'): HandLoad | null {
  const mine = notes.filter((n) => n.hand === hand).sort((a, b) => a.startMs - b.startMs)
  if (mine.length === 0) return null
  const steps: SongNote[][] = []
  for (const n of mine) {
    const last = steps[steps.length - 1]
    if (last && n.startMs - last[0].startMs <= TOGETHER_MS) last.push(n)
    else steps.push([n])
  }
  const pitches = mine.map((n) => n.pitch)
  const lead = steps.map((s) => (hand === 'right' ? Math.max(...s.map((n) => n.pitch)) : Math.min(...s.map((n) => n.pitch))))
  const gaps = steps.slice(1).map((s, i) => s[0].startMs - steps[i][0].startMs)
  const share = (under: number) => (gaps.length ? gaps.filter((g) => g < under).length / gaps.length : 0)
  return {
    notes: mine.length,
    range: Math.max(...pitches) - Math.min(...pitches),
    leap: Math.max(0, ...lead.slice(1).map((p, i) => Math.abs(p - lead[i]))),
    quick: share(QUICK_MS),
    veryQuick: share(VERY_QUICK_MS),
    chords: steps.filter((s) => s.length > 1).reduce((sum, s) => sum + s.length, 0) / mine.length,
  }
}

/** Points for what a song asks, summed; 0 is Easy, 1–3 Medium, 4 or more Harder. */
export function difficultyPoints(song: Song): number {
  const hands = [handLoad(song.notes, 'right'), handLoad(song.notes, 'left')].filter((h): h is HandLoad => h !== null)
  if (hands.length === 0) return 0
  const worst = (f: (h: HandLoad) => number) => Math.max(...hands.map(f))
  let points = 0
  // Reach: past a sixth the hand has to move; past two octaves it keeps moving.
  points += worst((h) => (h.range > 16 ? 2 : h.range > IN_HAND ? 1 : 0))
  // Jumps: past a sixth there's no reaching it; an octave or more is a leap to find.
  points += worst((h) => (h.leap >= 12 ? 2 : h.leap > IN_HAND - 2 ? 1 : 0))
  // Speed, at the song's own tempo (she can slow it; the level is for as written).
  points += worst((h) => (h.veryQuick >= SOME ? 2 : h.quick >= SOME ? 1 : 0))
  // Black keys.
  const pitches = song.notes.map((n) => n.pitch)
  if (pitches.filter((p) => BLACK.has(p % 12)).length / pitches.length > 0.1) points++
  // Chords in a hand.
  if (worst((h) => h.chords) > 0.15) points++
  // Both hands with real work: a left hand of slow roots under the tune (Twinkle's has half as many notes) doesn't count;
  // one that keeps pace with it (a waltz's bass and chords, an Alberti bass) does.
  const [right, left] = [handLoad(song.notes, 'right'), handLoad(song.notes, 'left')]
  if (right && left && left.notes >= right.notes * 0.75) points++
  return points
}

/** The level a song's notes earn, whatever it has been set to. */
export function ratedLevel(song: Song): Level {
  const points = difficultyPoints(song)
  return points === 0 ? 1 : points <= 3 ? 2 : 3
}

/** A song's level: the one it was given (the starter pack's, or one she chose), else the one its notes earn. */
export function levelOf(song: Song): Level {
  return song.level ?? ratedLevel(song)
}

/**
 * What to try after this song: the first song, easiest first, that she hasn't
 * finished yet, at this song's level or above; failing that, any she hasn't
 * finished. Null once she has finished them all.
 */
export function tryNext<T extends { song: Song }>(entries: readonly T[], finished: (songId: string) => boolean, currentId: string): T | null {
  const current = entries.find((e) => e.song.id === currentId)
  const floor = current ? levelOf(current.song) : 1
  const open = byLevel(entries).filter((e) => e.song.id !== currentId && !finished(e.song.id))
  return open.find((e) => levelOf(e.song) >= floor) ?? open[0] ?? null
}

/** Easiest first; songs of one level keep their order. */
export function byLevel<T extends { song: Song }>(entries: readonly T[]): T[] {
  return entries
    .map((e, i) => ({ e, i, l: levelOf(e.song) }))
    .sort((a, b) => a.l - b.l || a.i - b.i)
    .map((x) => x.e)
}
