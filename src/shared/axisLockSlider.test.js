import { describe, it, expect } from 'vitest'
import { pickAxis, valueFromClientX } from './axisLockSlider.js'

describe('pickAxis', () => {
  it('stays undecided inside the deadzone', () => {
    expect(pickAxis(3, 3)).toBeNull()
    expect(pickAxis(5, 0)).toBeNull()
  })

  it('picks x for a clearly horizontal gesture', () => {
    expect(pickAxis(20, 2)).toBe('x')
  })

  it('picks y for a clearly vertical gesture (the scroll case)', () => {
    expect(pickAxis(2, 20)).toBe('y')
  })

  it('is biased toward y (scroll) on a diagonal gesture — never favours x', () => {
    // equal displacement is the tie case; the pick must never be 'x' here,
    // since ambiguous gestures should default to "the user is scrolling"
    expect(pickAxis(10, 10)).not.toBe('x')
  })

  it('respects a custom deadzone', () => {
    expect(pickAxis(5, 0, 10)).toBeNull()
    expect(pickAxis(11, 0, 10)).toBe('x')
  })
})

describe('valueFromClientX', () => {
  const rect = { left: 100, width: 200 }

  it('maps the left edge to min and the right edge to max', () => {
    expect(valueFromClientX(100, rect, 0, 10, 1)).toBe(0)
    expect(valueFromClientX(300, rect, 0, 10, 1)).toBe(10)
  })

  it('maps the midpoint to the middle value', () => {
    expect(valueFromClientX(200, rect, 0, 10, 1)).toBe(5)
  })

  it('clamps a touch point outside the track', () => {
    expect(valueFromClientX(-50, rect, 0, 10, 1)).toBe(0)
    expect(valueFromClientX(9999, rect, 0, 10, 1)).toBe(10)
  })

  it('rounds to the given step', () => {
    // 37% of the way across a 0..10 track is 3.7, which should round to 4
    expect(valueFromClientX(100 + 0.37 * 200, rect, 0, 10, 1)).toBe(4)
  })

  it('is safe against a zero-width rect', () => {
    expect(() => valueFromClientX(150, { left: 100, width: 0 }, 0, 10, 1)).not.toThrow()
  })
})
