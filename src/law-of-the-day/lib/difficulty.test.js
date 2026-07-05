import { describe, it, expect } from 'vitest'
import {
  DIFFICULTIES,
  normalizeDifficulty,
  nextDifficulty,
  difficultyLevel,
  difficultyLabel,
} from './difficulty'

describe('difficulty', () => {
  it('exposes exactly three ordered tiers', () => {
    expect(DIFFICULTIES).toEqual(['standard', 'complex', 'extreme'])
  })

  it('cycles standard → complex → extreme → standard', () => {
    expect(nextDifficulty('standard')).toBe('complex')
    expect(nextDifficulty('complex')).toBe('extreme')
    expect(nextDifficulty('extreme')).toBe('standard')
  })

  it('normalizes unknown / legacy values to standard', () => {
    expect(normalizeDifficulty('extreme')).toBe('extreme')
    expect(normalizeDifficulty('bogus')).toBe('standard')
    expect(normalizeDifficulty(undefined)).toBe('standard')
  })

  it('maps each tier to a 1-based meter level', () => {
    expect(difficultyLevel('standard')).toBe(1)
    expect(difficultyLevel('complex')).toBe(2)
    expect(difficultyLevel('extreme')).toBe(3)
    expect(difficultyLevel('bogus')).toBe(1)
  })

  it('gives a human label for each tier', () => {
    expect(difficultyLabel('standard')).toBe('Standard')
    expect(difficultyLabel('complex')).toBe('Complex')
    expect(difficultyLabel('extreme')).toBe('Extreme')
    expect(difficultyLabel('bogus')).toBe('Standard')
  })
})
