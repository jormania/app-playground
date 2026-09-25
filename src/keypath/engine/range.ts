import { easyNotes } from './easy'
import type { Hand, Song, SongNote } from './song'

/** The PSR-E383's 61 keys, measured on the S24: C2–C7, MIDI 36–96. */
export const KEYBOARD_RANGE = { low: 36, high: 96 } as const

export interface RangeCheck {
  fits: boolean
  low: number
  high: number
  /** Notes outside the keyboard as written. */
  outside: number
  /**
   * Whole octaves (semitones, a multiple of 12) that bring every note onto the
   * keyboard, preferring the smallest move; null if the piece is wider than
   * the keyboard itself.
   */
  suggestedShift: number | null
}

export function checkRange(pitches: readonly number[], range = KEYBOARD_RANGE): RangeCheck {
  if (pitches.length === 0) return { fits: true, low: 0, high: 0, outside: 0, suggestedShift: 0 }
  const low = Math.min(...pitches)
  const high = Math.max(...pitches)
  const outside = pitches.filter((p) => p < range.low || p > range.high).length
  if (outside === 0) return { fits: true, low, high, outside, suggestedShift: 0 }
  const options: number[] = []
  for (let k = -4; k <= 4; k++) {
    const s = k * 12
    if (low + s >= range.low && high + s <= range.high) options.push(s)
  }
  options.sort((a, b) => Math.abs(a) - Math.abs(b))
  return { fits: false, low, high, outside, suggestedShift: options[0] ?? null }
}

export function transposeSong(song: Song, semitones: number): Song {
  return { ...song, notes: song.notes.map((n) => ({ ...n, pitch: n.pitch + semitones })) }
}

// ── Notes outside the keyboard ──────────────────────────────────────────────
// An added song can reach past the 61 keys. What to do about it is a choice
// with a cost either way, so it is offered, and can be changed later
// (KEYPATH_TUTOR.md §9, "Songs wider than the keyboard"):
//   moveSong   every note by the same whole octaves: sounds the same, lower or
//              higher; only possible when the song spans 61 keys or fewer
//   moveHands  each hand by its own whole octaves, when the song as a whole
//              is too wide but each hand fits
//   moveNotes  only the notes that don't fit, each by the fewest octaves; the
//              rest stay as written, those notes jump out of line (the
//              default when they are only a few: under 5% of the song)
//   dropNotes  leave out the notes that don't fit; nothing else changes

export type FitMode = NonNullable<Song['fit']>

export interface Fitted {
  notes: SongNote[]
  /** Semitones each hand was moved by, for the whole-song and per-hand moves. */
  shift: Record<Hand, number>
  /** Notes moved on their own (moveNotes). */
  moved: number
  /** Notes left out: the ones that don't fit (dropNotes), or a moved note that landed on one already sounding (moveNotes). */
  dropped: number
}

const inRange = (p: number, range: { low: number; high: number }) => p >= range.low && p <= range.high
const HANDS: Hand[] = ['right', 'left']

/** The fewest whole octaves that bring one pitch onto the keyboard. */
function octaveInto(p: number, range: { low: number; high: number }): number {
  let q = p
  while (q < range.low) q += 12
  while (q > range.high) q -= 12
  return q
}

/** Apply one of the choices. Ids are kept, so nothing that refers to a note by id moves. */
export function applyFit(notes: readonly SongNote[], mode: FitMode, range = KEYBOARD_RANGE): Fitted | null {
  const none: Record<Hand, number> = { right: 0, left: 0 }
  if (mode === 'moveSong') {
    const shift = checkRange(notes.map((n) => n.pitch), range).suggestedShift
    if (shift === null) return null
    return { notes: notes.map((n) => ({ ...n, pitch: n.pitch + shift })), shift: { right: shift, left: shift }, moved: 0, dropped: 0 }
  }
  if (mode === 'moveHands') {
    const shift = { ...none }
    for (const h of HANDS) {
      const s = checkRange(notes.filter((n) => n.hand === h).map((n) => n.pitch), range).suggestedShift
      if (s === null) return null
      shift[h] = s
    }
    return { notes: notes.map((n) => ({ ...n, pitch: n.pitch + shift[n.hand] })), shift, moved: 0, dropped: 0 }
  }
  if (mode === 'dropNotes') {
    const kept = notes.filter((n) => inRange(n.pitch, range))
    return { notes: kept, shift: none, moved: 0, dropped: notes.length - kept.length }
  }
  // moveNotes: a moved note that lands on the same key as another note starting
  // with it would be one key pressed twice; it is left out instead.
  const out: SongNote[] = []
  let moved = 0
  let dropped = 0
  const kept = notes.filter((n) => inRange(n.pitch, range))
  for (const n of notes) {
    if (inRange(n.pitch, range)) {
      out.push(n)
      continue
    }
    const pitch = octaveInto(n.pitch, range)
    if (kept.some((k) => k.pitch === pitch && Math.abs(k.startMs - n.startMs) <= 30) || out.some((k) => k.id !== n.id && k.pitch === pitch && Math.abs(k.startMs - n.startMs) <= 30)) {
      dropped++
      continue
    }
    out.push({ ...n, pitch })
    moved++
  }
  return { notes: out, shift: none, moved, dropped }
}

export interface FitOption extends Fitted {
  mode: FitMode
}

/**
 * The choices for a song with notes outside the keyboard, best first: the
 * whole-song move when it's possible, else each hand on its own when that is;
 * then moving just the stray notes, and leaving them out. Empty when every
 * note already fits.
 */
export function fitOptions(notes: readonly SongNote[], range = KEYBOARD_RANGE): FitOption[] {
  if (notes.every((n) => inRange(n.pitch, range))) return []
  const modes: FitMode[] = []
  if (applyFit(notes, 'moveSong', range)) modes.push('moveSong')
  else if (applyFit(notes, 'moveHands', range)) modes.push('moveHands')
  // Moving the stray notes is offered only if one of them actually moves: when
  // each would land on a key already sounding, it is the same as leaving them out.
  if (applyFit(notes, 'moveNotes', range)!.moved > 0) modes.push('moveNotes')
  modes.push('dropNotes')
  return modes.map((mode) => ({ mode, ...applyFit(notes, mode, range)! }))
}

/** Below this share of a song's notes outside the keyboard, only those move by default. */
export const FEW_OUTSIDE = 0.05

/**
 * The choice made when none is asked for. A few stray notes (under 5% of the
 * song, like five low bass notes in three hundred) move on their own, so the
 * rest stay where they were written, or are left out when moving them would
 * only double a key already sounding; a song that sits in the wrong octave as
 * a whole moves whole, or by hands.
 */
export function defaultFit(options: readonly FitOption[], total: number): FitMode | null {
  if (options.length === 0) return null
  const outside = options.find((o) => o.mode === 'dropNotes')?.dropped ?? 0
  if (total > 0 && outside / total < FEW_OUTSIDE) return options.some((o) => o.mode === 'moveNotes') ? 'moveNotes' : 'dropNotes'
  return options[0].mode
}

/** The notes the fit starts from: as written, or their easy version when the song is played easy. */
export const notesToFit = (song: Pick<Song, 'notes' | 'source' | 'easy'>): SongNote[] => {
  const source = song.source ?? song.notes
  return song.easy ? easyNotes(source) : source
}

const endOf = (notes: readonly SongNote[]) => (notes.length ? Math.max(...notes.map((n) => n.startMs + n.durationMs)) : 0)

/**
 * The song as it will be played: its notes as written (`source`), made easy
 * when it is played easy, put through the chosen fit, or the default one.
 * The notes as written are kept whenever what is played differs from them.
 */
export function fitSong(song: Song, mode: FitMode | null, range = KEYBOARD_RANGE): Song {
  const source = song.source ?? song.notes
  const base = notesToFit(song)
  const options = fitOptions(base, range)
  if (options.length === 0) return song.easy ? { ...song, notes: base, source, fit: undefined, durationMs: endOf(base) } : { ...song, notes: source, source: undefined, fit: undefined, durationMs: endOf(source) }
  const best = defaultFit(options, base.length)
  // A choice made for other notes (the song as written, before the easy version) may not be on offer: the best one, then.
  const chosen = options.find((o) => o.mode === (mode ?? best)) ?? options.find((o) => o.mode === best)!
  return { ...song, notes: chosen.notes, source, fit: chosen.mode, durationMs: endOf(chosen.notes) }
}
