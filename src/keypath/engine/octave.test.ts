import { describe, expect, it } from 'vitest'
import { notMiddleC, octaveShift } from './octave'

describe('the middle-C check', () => {
  it('takes any C as middle C, an octave or two away, and nothing else', () => {
    expect(octaveShift(48)).toBe(12)
    expect(octaveShift(72)).toBe(-12)
    expect(octaveShift(62)).toBeNull()
  })

  it('reads the same wrong key twice running as a Transpose, and a different one as another key', () => {
    expect(notMiddleC(62, null)).toBe('otherKey')
    // Transpose +2: the marked key sends D every time.
    expect(notMiddleC(62, 62)).toBe('transposed')
    expect(notMiddleC(64, 62)).toBe('otherKey')
  })
})
