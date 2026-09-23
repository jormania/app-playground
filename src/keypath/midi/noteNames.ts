const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

/**
 * Scientific pitch notation: MIDI 60 = C4 (middle C), which is what teaching
 * material and Nora's future sheet music use. Yamaha's own Data List numbers
 * octaves one lower (60 = C3) — so the keyboard's documentation and this app
 * will disagree by an octave on paper while agreeing on the key.
 */
export function noteName(note: number): string {
  return `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`
}

export function isBlackKey(note: number): boolean {
  return BLACK.has(((note % 12) + 12) % 12)
}

/**
 * The PSR-E383's 61 keys, assuming Transpose 0: C2–C7 in scientific pitch,
 * MIDI 36–96. The probe widens its keyboard if a note lands outside this, and
 * the report records the lowest/highest note actually seen.
 */
export const PSR_E383_RANGE = { low: 36, high: 96 } as const
