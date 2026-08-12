import { describe, it, expect } from 'vitest'
import { validateHardMode } from './hardMode'

describe('validateHardMode', () => {
  it('allows a guess that reuses every revealed hint', () => {
    // ROBOT vs ROOMS: R/O green, second O yellow. RODEO keeps both greens and reuses the O.
    expect(validateHardMode('rodeo', 'rooms', 'robot')).toBeNull()
  })

  it('rejects a guess that moves a green letter', () => {
    expect(validateHardMode('aaaaa', 'rooms', 'robot')).toBe('Must use R in position 1')
  })

  it('rejects a guess that drops a yellow letter', () => {
    // ROMAN keeps R and O in place but abandons the second (yellow) O.
    expect(validateHardMode('roman', 'rooms', 'robot')).toBe('Guess must contain O')
  })

  it('requires a repeated yellow to appear the same number of times', () => {
    // SPEED against ERASE: S present, E present, E present, D absent.
    // TEPEE reuses two E's and the S is dropped -> must complain about S.
    expect(validateHardMode('tepee', 'speed', 'erase')).toBe('Guess must contain S')
  })

  it('does not let a green position double as payment for its own yellow', () => {
    // ROBOT vs ROOMS again: the O at index 1 is green, so it cannot also satisfy the
    // separate yellow O at index 2 — ROOMY reuses only the green O and must be rejected.
    expect(validateHardMode('roomy', 'rooms', 'robot')).toBeNull()
    expect(validateHardMode('robin', 'rooms', 'robot')).toBe('Guess must contain O')
  })

  it('reports the leftmost violated green first', () => {
    expect(validateHardMode('xxxxx', 'rooms', 'robot')).toBe('Must use R in position 1')
  })
})
