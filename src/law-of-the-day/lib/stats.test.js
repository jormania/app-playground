import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'

const laws = [
  { id: 1, lawNumber: 1, lawTitle: 'Law One' },
  { id: 2, lawNumber: 2, lawTitle: 'Law Two' },
  { id: 3, lawNumber: 3, lawTitle: 'Law Three' },
]

describe('computeStats', () => {
  it('returns all zeros for empty history', () => {
    const stats = computeStats(laws, {})
    expect(stats).toEqual({
      lawsSeen: 0,
      totalLaws: 3,
      totalAnswers: 0,
      seasonsCompleted: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracyPercent: 0,
      perLaw: [],
    })
  })

  it('aggregates a single answered law', () => {
    const history = { 2: { correctCount: 3, incorrectCount: 1, lastAnsweredCorrect: true, lastAnsweredDate: '2026-07-01' } }
    const stats = computeStats(laws, history)
    expect(stats.lawsSeen).toBe(1)
    expect(stats.totalLaws).toBe(3)
    expect(stats.totalAnswers).toBe(4)
    expect(stats.seasonsCompleted).toBe(1)
    expect(stats.correctCount).toBe(3)
    expect(stats.incorrectCount).toBe(1)
    expect(stats.accuracyPercent).toBe(75)
    expect(stats.perLaw).toEqual([
      { lawId: 2, lawNumber: 2, lawTitle: 'Law Two', correctCount: 3, incorrectCount: 1, lastAnsweredCorrect: true },
    ])
  })

  it('sums correct/incorrect across multiple laws and sorts perLaw by lawId', () => {
    const history = {
      3: { correctCount: 1, incorrectCount: 0, lastAnsweredCorrect: true, lastAnsweredDate: '2026-07-02' },
      1: { correctCount: 0, incorrectCount: 2, lastAnsweredCorrect: false, lastAnsweredDate: '2026-07-01' },
    }
    const stats = computeStats(laws, history)
    expect(stats.lawsSeen).toBe(2)
    expect(stats.totalAnswers).toBe(3)
    expect(stats.correctCount).toBe(1)
    expect(stats.incorrectCount).toBe(2)
    expect(stats.perLaw.map((l) => l.lawId)).toEqual([1, 3])
  })

  it('rounds accuracy to the nearest whole percent', () => {
    const history = { 1: { correctCount: 1, incorrectCount: 2, lastAnsweredCorrect: false, lastAnsweredDate: '2026-07-01' } }
    const stats = computeStats(laws, history)
    expect(stats.accuracyPercent).toBe(33)
  })

  it('ignores history entries for law ids not present in the laws array', () => {
    const history = { 99: { correctCount: 5, incorrectCount: 0, lastAnsweredCorrect: true, lastAnsweredDate: '2026-07-01' } }
    const stats = computeStats(laws, history)
    expect(stats.lawsSeen).toBe(0)
    expect(stats.correctCount).toBe(0)
  })

  it('counts completed seasons as full cycles through every law', () => {
    // 3 laws, 7 total answers -> 2 completed cycles (6) plus 1 into the 3rd.
    const history = {
      1: { correctCount: 3, incorrectCount: 0, lastAnsweredCorrect: true, lastAnsweredDate: '2026-07-01' },
      2: { correctCount: 2, incorrectCount: 1, lastAnsweredCorrect: false, lastAnsweredDate: '2026-07-02' },
      3: { correctCount: 1, incorrectCount: 0, lastAnsweredCorrect: true, lastAnsweredDate: '2026-07-03' },
    }
    const stats = computeStats(laws, history)
    expect(stats.totalAnswers).toBe(7)
    expect(stats.seasonsCompleted).toBe(2)
  })
})
