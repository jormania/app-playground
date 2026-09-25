import type { SongNote } from './song'

// The easy version of an added song (KEYPATH_TUTOR.md §9, "The easy version"):
// an arrangement written for someone who already plays, made into something a
// beginner can learn. It stays recognisably the song, only thinner:
//   the right hand   the melody alone: the top note wherever notes start
//                    together; nothing from an inner voice under a note
//                    still held above it, nor a lower note the tune enters
//                    over before it is half done;
//   the left hand    one note a bar: the lowest of the bar's first notes,
//                    held for as long as the bar's notes sounded;
//   stray notes      a note more than an octave beyond the middle half of its
//                    hand (a bass note in the right hand's staff, two octaves
//                    below it) moves by whole octaves to the octave nearest
//                    the hand's middle, so a handful of notes don't stretch
//                    the keyboard;
//   the key          a song mostly on black keys (Believer, in B♭ minor)
//                    moves by up to half an octave to the key with the fewest,
//                    when that at least halves them: B♭ minor becomes A minor,
//                    one semitone lower, nearly all white keys.
// It is built from the notes as written every time, so it can be switched off
// again without adding the song afresh. Free of React.

/** Notes starting within this of each other are played together. */
const TOGETHER_MS = 30
/** A note this far (semitones) beyond the middle half of its hand is a stray. */
const STRAY = 12

/** Notes starting together, in time order. */
function onsets(notes: readonly SongNote[]): SongNote[][] {
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
  const groups: SongNote[][] = []
  for (const n of sorted) {
    const last = groups[groups.length - 1]
    if (last && n.startMs - last[0].startMs <= TOGETHER_MS) last.push(n)
    else groups.push([n])
  }
  return groups
}

/** The right hand's tune: one note at a time, the top one. */
export function melody(notes: readonly SongNote[]): SongNote[] {
  const out: SongNote[] = []
  const groups = onsets(notes)
  for (const [i, group] of groups.entries()) {
    const top = group.reduce((a, b) => (b.pitch > a.pitch ? b : a))
    // A higher note entering before this one is half done: this one is accompaniment, that one the tune.
    const half = top.startMs + top.durationMs / 2
    let over = false
    for (let j = i + 1; j < groups.length && groups[j][0].startMs < half && !over; j++) over = groups[j].some((x) => x.pitch > top.pitch)
    if (over) continue
    const prev = out[out.length - 1]
    if (prev && prev.startMs + prev.durationMs > top.startMs + TOGETHER_MS) {
      // A lower voice moving under a note still held: not the tune.
      if (top.pitch <= prev.pitch) continue
      // The tune moves on before the held note ends: one note at a time.
      out[out.length - 1] = { ...prev, durationMs: Math.max(1, top.startMs - prev.startMs) }
    }
    out.push(top)
  }
  return out
}

/** The left hand's bass: one note a bar, held through it. */
export function bassPerBar(notes: readonly SongNote[]): SongNote[] {
  const bars = new Map<number, SongNote[]>()
  for (const n of notes) bars.set(n.bar, [...(bars.get(n.bar) ?? []), n])
  const out: SongNote[] = []
  for (const bar of [...bars.keys()].sort((a, b) => a - b)) {
    const inBar = bars.get(bar)!
    const first = onsets(inBar)[0]
    const root = first.reduce((a, b) => (b.pitch < a.pitch ? b : a))
    const end = Math.max(...inBar.map((n) => n.startMs + n.durationMs))
    out.push({ ...root, durationMs: Math.max(root.durationMs, end - root.startMs) })
  }
  // Each note ends before the next begins, so no key is held into the next bar's.
  for (let i = 0; i + 1 < out.length; i++) {
    const gap = out[i + 1].startMs - out[i].startMs
    if (out[i].durationMs > gap) out[i] = { ...out[i], durationMs: Math.max(1, Math.round(gap * 0.95)) }
  }
  return out
}

/** A hand's stray notes moved by whole octaves into where the rest of it plays. */
export function foldStrays(notes: readonly SongNote[]): SongNote[] {
  if (notes.length < 10) return [...notes]
  const pitches = notes.map((n) => n.pitch).sort((a, b) => a - b)
  const at = (share: number) => pitches[Math.floor(pitches.length * share)]
  const [low, middle, high] = [at(0.25), at(0.5), at(0.75)]
  return notes.map((n) => {
    if (n.pitch >= low - STRAY && n.pitch <= high + STRAY) return n
    return { ...n, pitch: n.pitch + Math.round((middle - n.pitch) / 12) * 12 }
  })
}

const BLACK = new Set([1, 3, 6, 8, 10])
const blacks = (notes: readonly SongNote[], shift: number) => notes.filter((n) => BLACK.has((((n.pitch + shift) % 12) + 12) % 12)).length
/** Below this share of black keys, a song stays in its key. */
const FEW_BLACK = 0.1

/** Semitones that move a song to the key with the fewest black keys; 0 when that isn't worth it. */
export function whiterKey(notes: readonly SongNote[]): number {
  const now = blacks(notes, 0)
  if (notes.length === 0 || now / notes.length <= FEW_BLACK) return 0
  let best = 0
  // The smallest move wins a tie, and down before up: the song stays nearest where it was written.
  for (const shift of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6]) if (blacks(notes, shift) < blacks(notes, best)) best = shift
  return blacks(notes, best) <= now / 2 ? best : 0
}

/** The easy version of a song's notes, as written. Ids are kept, so nothing that refers to a note by id moves. */
export function easyNotes(notes: readonly SongNote[]): SongNote[] {
  const right = foldStrays(melody(notes.filter((n) => n.hand === 'right')))
  const left = foldStrays(bassPerBar(notes.filter((n) => n.hand === 'left')))
  const both = [...right, ...left]
  const shift = whiterKey(both)
  return both.map((n) => (shift ? { ...n, pitch: n.pitch + shift } : n)).sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
}
