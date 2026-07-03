import { describe, it, expect } from 'vitest'
import { STATE_WORDS, closingLine, type StateCheckinSelection } from './stateCheckin'

const EMPTY: StateCheckinSelection = { named: null, intensity: null, desired: null }

describe('STATE_WORDS', () => {
  it('is non-empty with no duplicates', () => {
    expect(STATE_WORDS.length).toBeGreaterThan(0)
    expect(new Set(STATE_WORDS).size).toBe(STATE_WORDS.length)
  })
})

describe('closingLine', () => {
  it('returns null when named is missing', () => {
    expect(closingLine({ ...EMPTY, desired: 'Calm' })).toBeNull()
  })
  it('returns null when desired is missing', () => {
    expect(closingLine({ ...EMPTY, named: 'Anxious' })).toBeNull()
  })
  it('returns the named/desired sentence once both are set', () => {
    expect(closingLine({ ...EMPTY, named: 'Anxious', desired: 'Calm' })).toBe(
      'Named: anxious. Choosing: calm — let your thoughts and body follow.',
    )
  })
  it('returns the "already there" variant when named equals desired', () => {
    expect(closingLine({ ...EMPTY, named: 'Calm', desired: 'Calm' })).toBe(
      'Already there — let calm settle in.',
    )
  })
})
