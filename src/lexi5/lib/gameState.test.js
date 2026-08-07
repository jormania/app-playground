import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getWord, parseSeed, isValidGuess } from './gameState'

describe('gameState logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getWord generates a deterministic word based on seed data', () => {
    const word1 = getWord('standard', '2026-08-07', 0)
    const word2 = getWord('standard', '2026-08-07', 0)
    const word3 = getWord('standard', '2026-08-07', 1)
    
    expect(word1).toBeDefined()
    expect(typeof word1).toBe('string')
    expect(word1).toBe(word2)
    expect(word1).not.toBe(word3) // different iteration yields different word
  })
  
  it('getWord defaults to standard dictionary if missing', () => {
    const word1 = getWord('unknown_dict', '2026-08-07', 0)
    const word2 = getWord('standard', '2026-08-07', 0)
    expect(word1).toBe(word2)
  })

  it('parseSeed correctly decodes valid seeds', () => {
    // encode "2026-08-07|1|expanded"
    const validSeed = btoa('2026-08-07|1|expanded')
    const parsed = parseSeed(validSeed)
    
    expect(parsed).toEqual({
      date: '2026-08-07',
      iteration: 1,
      dictionary: 'expanded'
    })
  })

  it('parseSeed returns null for invalid seeds', () => {
    expect(parseSeed('invalid_base64_+++')).toBeNull()
    expect(parseSeed(btoa('missing_parts'))).toBeNull()
  })
  
  it('isValidGuess validates guesses against the dictionary', () => {
    expect(isValidGuess('apple')).toBe(true)
    expect(isValidGuess('zzzzz')).toBe(false) // Assuming zzzzz is not in the dictionary
  })
})
