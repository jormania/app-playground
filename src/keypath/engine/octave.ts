/**
 * The one-key check at the start of a session: ask for middle C, see what
 * arrives. The PSR-E383 sends the pitch the voice *sounds*, so Transpose and
 * the per-voice Octave settings shift every note (KEYPATH.md §1). Returns the
 * shift to add to incoming notes, or null when the key pressed wasn't a C at
 * all (a transpose by some other interval, or just the wrong key — ask again).
 */
export function octaveShift(received: number, expected = 60): number | null {
  const diff = expected - received
  return diff % 12 === 0 ? diff : null
}
