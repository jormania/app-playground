import type { Song } from './song'

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
