import { describe, expect, it } from 'vitest'
import { countBeatMs } from './countIn'

describe('the counted beat before a song on the clock', () => {
  it('is the song’s own beat where it can be counted aloud, and a group of beats where it is too quick', () => {
    expect(countBeatMs({ bpm: 100 })).toBe(600)
    // Für Elise, in sixteenths at 360: counted in eighths, half a second each.
    expect(countBeatMs({ bpm: 360 })).toBeCloseTo(500)
    // A quick song at 200: two beats a count.
    expect(countBeatMs({ bpm: 200 })).toBe(600)
  })
})
