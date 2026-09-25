import { describe, expect, it } from 'vitest'
import { LOOK_AHEAD_MS, PX_PER_MS, pxPerMsFor } from './FallingNotes'

describe('how tightly the notes fall', () => {
  it('keeps the usual spacing where the fall is tall, and packs closer where it is short, so over two seconds stay in view', () => {
    expect(pxPerMsFor(490)).toBe(PX_PER_MS)
    const short = pxPerMsFor(142)
    expect(short).toBeLessThan(PX_PER_MS)
    expect(142 / short).toBeCloseTo(LOOK_AHEAD_MS)
    // Never so tight that a note stops reading as a note.
    expect(pxPerMsFor(20)).toBe(0.045)
  })
})
