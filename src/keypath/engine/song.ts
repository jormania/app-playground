// The tutor's own model of a piece: what every door plays and judges. Built
// from an imported MIDI file (parts.ts) or, later, the starter pack.

export type Hand = 'right' | 'left'
/** Pianists' finger numbers: 1 is the thumb on both hands, 5 the little finger. */
export type Finger = 1 | 2 | 3 | 4 | 5

export interface SongNote {
  /** Stable within the song; the judge reports against it. */
  id: number
  pitch: number
  startMs: number
  durationMs: number
  hand: Hand
  /** 0-based bar number, from the time signature. */
  bar: number
  /** Which finger plays it, where the song says (the starter pack does; imported files don't). */
  finger?: Finger
}

export interface Song {
  id: string
  title: string
  notes: SongNote[]
  /** Tempo at the start, for display. The notes' ms already include every tempo change. */
  bpm: number
  beatsPerBar: number
  durationMs: number
  /** Where each phrase starts (0-based bars), when the song says; songs in parts split there. */
  phrases?: number[]
  /** How hard it is, 1 (easy) to 3, when the song says; otherwise worked out from the notes. */
  level?: 1 | 2 | 3
  /**
   * An added song that reaches past the keyboard keeps its notes as written
   * here, and `fit` says how `notes` were made to fit (engine/range.ts), so the
   * choice can be changed later without adding the song again.
   */
  source?: SongNote[]
  fit?: 'moveSong' | 'moveHands' | 'moveNotes' | 'dropNotes'
}

/** Notes meant to be played together: a chord, or a single note. */
export interface Step {
  index: number
  startMs: number
  notes: SongNote[]
}

/**
 * Notes that start within `togetherMs` of each other form one step. In a
 * score they usually start at exactly the same tick; the tolerance absorbs
 * files recorded from a live performance.
 */
export function stepsOf(notes: readonly SongNote[], togetherMs = 30): Step[] {
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
  const steps: Step[] = []
  for (const n of sorted) {
    const last = steps[steps.length - 1]
    if (last && n.startMs - last.startMs <= togetherMs) last.notes.push(n)
    else steps.push({ index: steps.length, startMs: n.startMs, notes: [n] })
  }
  return steps
}

export type Practice = 'right' | 'left' | 'both'

export function notesFor(song: Song, practice: Practice): SongNote[] {
  return practice === 'both' ? song.notes : song.notes.filter((n) => n.hand === practice)
}
