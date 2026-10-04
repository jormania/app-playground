import { describe, expect, it } from 'vitest'
import { HeldKeys } from './heldKeys'

describe('a key let go is the key it pressed', () => {
  it('releases the key drawn when it went down, even after the octave shift changed', () => {
    const keys = new HeldKeys()
    // Keyboard an octave down: middle C arrives as 48, drawn as 48 before the shift is known…
    keys.down(48, 48)
    // …the check finds a shift of +12, and the key comes up: it lets go of 48, not 60.
    expect(keys.up(48, 48 + 12)).toBe(48)
    // From then on, keys go down and up under the same shift.
    keys.down(50, 62)
    expect(keys.up(50, 62)).toBe(62)
  })

  it('falls back to the shift for a key never seen going down, and forgets everything when the keyboard goes', () => {
    const keys = new HeldKeys()
    expect(keys.up(55, 67)).toBe(67)
    keys.down(60, 60)
    keys.clear()
    expect(keys.up(60, 72)).toBe(72)
  })
})
