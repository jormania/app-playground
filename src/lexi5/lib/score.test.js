import { describe, it, expect } from 'vitest'
import { scoreGuess, keyStatuses } from './score'

describe('scoreGuess', () => {
  it('marks exact matches correct and misses absent', () => {
    expect(scoreGuess('crane', 'crane')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
    expect(scoreGuess('bbbbb', 'crane')).toEqual(['absent', 'absent', 'absent', 'absent', 'absent'])
  })

  it('marks a misplaced letter present', () => {
    // ROBOT: R correct, O correct, O misplaced (a second O exists), M/S absent
    expect(scoreGuess('rooms', 'robot')).toEqual(['correct', 'correct', 'present', 'absent', 'absent'])
  })

  it('never credits a letter to more tiles than the answer contains', () => {
    // The bug this module exists to kill: the share card scored this as five tiles of
    // "O is in the word" — three yellows the player never earned. ROBOT has exactly two
    // O's, both of which land on exact matches, so nothing is left over to be yellow.
    expect(scoreGuess('ooooo', 'robot')).toEqual(['absent', 'correct', 'absent', 'correct', 'absent'])
  })

  it('gives exact matches priority over earlier misplaced ones', () => {
    // REBEL has two E's. The exact match at index 1 claims one first; the leading E then
    // takes the remaining one, and the trailing E finds nothing left. A single-pass scorer
    // would let the leading E consume the E that the positional match is entitled to.
    expect(scoreGuess('eerie', 'rebel')).toEqual(['present', 'correct', 'present', 'absent', 'absent'])
  })

  it('is case-insensitive on both sides', () => {
    expect(scoreGuess('CRANE', 'crane')).toEqual(scoreGuess('crane', 'CRANE'))
  })
})

describe('keyStatuses', () => {
  it('keeps the best status a letter has earned across guesses', () => {
    // O is present in the first guess and correct in the second — the key must not
    // regress to yellow once green has been proven.
    const statuses = keyStatuses(['boost', 'robot'], 'robot')
    expect(statuses.O).toBe('correct')
    expect(statuses.R).toBe('correct')
  })

  it('marks letters the answer does not contain absent', () => {
    expect(keyStatuses(['zzzzz'], 'robot').Z).toBe('absent')
  })

  it('agrees with the board about whether a letter is in the word', () => {
    // Aggregate key status is derived from the same scorer, so a key can't claim a
    // letter is present when every tile of it scored absent.
    const statuses = keyStatuses(['ooooo'], 'robot')
    expect(statuses.O).toBe('correct')
  })

  it('returns nothing for letters never guessed', () => {
    expect(keyStatuses(['crane'], 'robot').Z).toBeUndefined()
  })
})
