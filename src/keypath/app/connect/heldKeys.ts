/**
 * Which key on the screen each of the keyboard's keys pressed. A key goes
 * down under one octave shift and can come up under another (the middle-C
 * check finds the shift on that very key), so its release is matched to the
 * key it pressed, not worked out again: otherwise that key stays drawn held.
 */
export class HeldKeys {
  private readonly drawn = new Map<number, number>()

  /** The keyboard's `raw` key went down, drawn as `drawn`. */
  down(raw: number, drawn: number): number {
    this.drawn.set(raw, drawn)
    return drawn
  }

  /** The keyboard's `raw` key came up: the key it pressed, or `fallback` for one never seen going down. */
  up(raw: number, fallback: number): number {
    const d = this.drawn.get(raw) ?? fallback
    this.drawn.delete(raw)
    return d
  }

  /** The keyboard is gone: none of its keys is down any more. */
  clear(): void {
    this.drawn.clear()
  }
}
