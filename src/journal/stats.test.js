import { test, expect, describe } from 'vitest'
import { computeStats } from './stats.js'

const today = new Date(2026, 5, 24) // 24 Jun 2026

const entries = [
  { date: '2026-06-24', entry: 'one two three', tags: ['light'], people: ['Mara'], wordCount: 3 },
  { date: '2026-06-22', entry: 'one two three four five', tags: ['light', 'rain'], people: ['Mara'], wordCount: 5 },
  { date: '2026-06-10', entry: 'a', tags: ['rain'], people: ['Sol'], wordCount: 1 },
  { date: '2026-06-01', entry: 'one two three four', tags: ['light'], people: [], wordCount: 4 },
]

describe('computeStats', () => {
  const s = computeStats(entries, today)

  test('total entries', () => expect(s.total).toBe(4))
  test('entries in the last 7 days (incl today)', () => expect(s.last7).toBe(2)) // 24th + 22nd
  test('average words per entry', () => expect(s.avgWords).toBe(3)) // (3+5+1+4)/4 = 3.25 -> 3
  test('total words across all entries', () => expect(s.totalWords).toBe(13))
  test('days since first delight', () => expect(s.daysSinceFirst).toBe(23)) // Jun 1 -> Jun 24
  test('longest and shortest entry (words)', () => {
    expect(s.longest).toBe(5)
    expect(s.shortest).toBe(1)
  })
  test('top tags, most frequent first', () => {
    expect(s.topTags).toEqual([{ name: 'light', count: 3 }, { name: 'rain', count: 2 }])
  })
  test('top people', () => {
    expect(s.topPeople).toEqual([{ name: 'Mara', count: 2 }, { name: 'Sol', count: 1 }])
  })
  test('falls back to live word count when wordCount is absent', () => {
    const s2 = computeStats([{ date: '2026-06-24', entry: 'one two three four', tags: [], people: [] }], today)
    expect(s2.avgWords).toBe(4)
    expect(s2.totalWords).toBe(4)
  })
  test('empty journal is all zeroes, no crash', () => {
    const z = computeStats([], today)
    expect(z).toMatchObject({ total: 0, last7: 0, avgWords: 0, totalWords: 0, daysSinceFirst: null })
  })
})
