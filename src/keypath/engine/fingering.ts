import type { Finger, Hand, Song, SongNote } from './song'

// Suggested fingers for an added song (KEYPATH_TUTOR.md §9, "Suggested
// fingers"): a MIDI file carries no fingering, and the right finger on each
// key is what lets a tune flow. Worked out per hand, with plain rules:
//   - a run of single notes gets the cheapest way through it (a dynamic
//     programme): neighbouring notes on neighbouring fingers, the thumb
//     tucked under going out and crossed over coming in, a repeated note on
//     the same finger, a big leap a move of the hand, the thumb and little
//     finger kept off the black keys;
//   - a chord takes fingers by its size: 1 3 5 for a triad, 1 5 for a wide
//     pair, and so on.
// They are only suggestions: drawn dashed, and never written over fingers a
// score printed. Free of React.

/** Notes struck within this of each other are one chord. */
const TOGETHER_MS = 40
/** A rest this long ends a run: the hand may have moved. */
const REST_MS = 1500
/** The most (semitones) two fingers this far apart can cover, by how many fingers apart. */
const REACH = [0, 4, 6, 8, 12]
/** Past this many semitones the hand moves rather than stretches. */
const LEAP = 7
const BLACK = new Set([1, 3, 6, 8, 10])
const FINGERS: readonly Finger[] = [1, 2, 3, 4, 5]

const ideal = (span: number) => Math.max(1, Math.min(4, Math.round(span / 2)))

/** What a finger costs on a key: the thumb and the little finger sit badly on black keys; the fourth is the weakest finger. */
const onKey = (f: Finger, pitch: number) => (BLACK.has(((pitch % 12) + 12) % 12) ? (f === 1 ? 2 : f === 5 ? 1 : 0) : 0) + (f === 4 ? 0.3 : f === 5 ? 0.1 : 0)

/** The cost of going from one note and finger to the next in the same hand, or null when the hand can't. */
function move(hand: Hand, a: number, fa: Finger, b: number, fb: Finger): number | null {
  const d = b - a
  if (d === 0) return fa === fb ? 0 : null
  const out = (hand === 'right' ? 1 : -1) * Math.sign(d) // +1 towards the little finger, -1 towards the thumb
  const span = Math.abs(d)
  if (span > LEAP) return 2
  const df = (fb - fa) * out // fingers moved in the direction the notes moved
  if (df > 0) return span <= REACH[Math.min(4, df)] ? Math.abs(df - ideal(span)) : null
  // Against the keys: only the thumb goes under (going out) or a finger crosses over it (coming in);
  // easiest from the middle fingers, awkward from the second or little finger.
  if (out > 0 && fb === 1 && fa >= 2) return 3 + (fa === 2 ? 1 : fa === 5 ? 2 : 0)
  if (out < 0 && fa === 1 && fb >= 2) return 3 + (fb === 2 ? 1 : fb === 5 ? 2 : 0)
  return null
}

/** Fingers for one run of single notes, cheapest first. */
function runFingers(hand: Hand, pitches: readonly number[]): Finger[] {
  const n = pitches.length
  const best: number[][] = []
  const from: Finger[][] = []
  for (let i = 0; i < n; i++) {
    best.push([])
    from.push([])
    for (const f of FINGERS) {
      const own = onKey(f, pitches[i])
      if (i === 0) {
        best[i][f] = own
        continue
      }
      let cost = Infinity
      let via: Finger = 1
      for (const g of FINGERS) {
        const step = move(hand, pitches[i - 1], g, pitches[i], f)
        if (step === null || best[i - 1][g] === undefined) continue
        const c = best[i - 1][g] + step + own
        if (c < cost) {
          cost = c
          via = g
        }
      }
      best[i][f] = cost
      from[i][f] = via
    }
  }
  // The cheapest way in, walked back from the end; a run no hand could play gets the plain order.
  let f = FINGERS.reduce((a, b) => (best[n - 1][b] < best[n - 1][a] ? b : a))
  if (!Number.isFinite(best[n - 1][f])) return pitches.map((_, i) => FINGERS[Math.min(4, i)])
  const out: Finger[] = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    out[i] = f
    if (i > 0) f = from[i][f]
  }
  return out
}

/** Fingers for a chord, lowest note first (whichever hand): thumb-side first. */
function chordFingers(hand: Hand, pitches: readonly number[]): Finger[] | null {
  const span = Math.max(...pitches) - Math.min(...pitches)
  const size = pitches.length
  const set: Finger[] | null = size === 2 ? (span <= 4 ? [1, 3] : [1, 5]) : size === 3 ? [1, 3, 5] : size === 4 ? [1, 2, 3, 5] : size === 5 ? [1, 2, 3, 4, 5] : null
  if (!set) return null
  // The right thumb is the lowest note, the left thumb the highest.
  return hand === 'right' ? set : [...set].reverse()
}

/** A hand's notes in order, in onsets: singles gather into runs, chords stand alone. */
function fingerHand(hand: Hand, notes: readonly SongNote[]): Map<number, Finger> {
  const out = new Map<number, Finger>()
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
  const onsets: SongNote[][] = []
  for (const n of sorted) {
    const last = onsets[onsets.length - 1]
    if (last && n.startMs - last[0].startMs <= TOGETHER_MS) last.push(n)
    else onsets.push([n])
  }
  let run: SongNote[] = []
  const flush = () => {
    if (run.length) runFingers(hand, run.map((n) => n.pitch)).forEach((f, i) => out.set(run[i].id, f))
    run = []
  }
  onsets.forEach((o, i) => {
    const prev = onsets[i - 1]
    if (prev && o[0].startMs - (prev[0].startMs + Math.max(...prev.map((n) => n.durationMs))) > REST_MS) flush()
    if (o.length === 1) return void run.push(o[0])
    flush()
    const fs = chordFingers(hand, o.map((n) => n.pitch))
    if (!fs) return
    const byPitch = [...o].sort((a, b) => a.pitch - b.pitch)
    byPitch.forEach((n, j) => out.set(n.id, fs[j]))
  })
  flush()
  return out
}

/** Suggested fingers for every note that has none, when no note of the song has one written. */
export function suggestFingers(notes: readonly SongNote[]): SongNote[] {
  if (notes.some((n) => n.finger)) return [...notes]
  const byHand = (h: Hand) => fingerHand(h, notes.filter((n) => n.hand === h))
  const [right, left] = [byHand('right'), byHand('left')]
  return notes.map((n) => {
    const f = (n.hand === 'right' ? right : left).get(n.id)
    return f ? { ...n, finger: f } : { ...n }
  })
}

/**
 * The song with suggested fingers, unless its score wrote its own. Recomputed
 * whenever the notes change (the easy version, a move by hand, the fit), from
 * the notes without the last suggestion, so it always suits the notes played.
 */
export function withSuggestedFingers(song: Song): Song {
  const authored = !song.fingersSuggested && song.notes.some((n) => n.finger)
  if (authored) return song
  const bare = song.notes.map((n) => {
    const { finger: _f, ...rest } = n
    return rest as SongNote
  })
  const notes = suggestFingers(bare)
  return notes.some((n) => n.finger) ? { ...song, notes, fingersSuggested: true } : song
}
