import { test, expect, describe } from 'vitest'
import {
  todayKey, keyToDate, formatHuman, formatShort, formatMedium, findByDate, hasEntryOn,
  sortByDateDesc, monthGrid, stepMonth, entriesOnSameDay, yearGrid,
} from './dates.js'

describe('todayKey / keyToDate (local, not UTC)', () => {
  test('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  test('keyToDate returns local midnight, round-tripping todayKey', () => {
    const d = keyToDate('2026-06-24')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(24)
    expect(todayKey(d)).toBe('2026-06-24')
  })
  test('keyToDate rejects junk', () => {
    expect(keyToDate('')).toBe(null)
    expect(keyToDate(null)).toBe(null)
  })
})

describe('formatting', () => {
  test('formatHuman', () => expect(formatHuman('2026-06-24')).toBe('Wednesday, 24 June 2026'))
  test('formatShort', () => expect(formatShort('2026-06-24')).toBe('24 Jun'))
  test('formatMedium', () => expect(formatMedium('2026-06-24')).toBe('24 Jun 2026'))
  test('formatMedium rejects junk like keyToDate does', () => expect(formatMedium('')).toBe(''))
})

describe('one-entry-per-date helpers', () => {
  const entries = [{ date: '2026-06-23', title: 'a' }, { date: '2026-06-24', title: 'b' }]
  test('findByDate returns the matching entry', () => {
    expect(findByDate(entries, '2026-06-24').title).toBe('b')
  })
  test('findByDate returns null when absent', () => {
    expect(findByDate(entries, '2026-06-25')).toBe(null)
  })
  test('hasEntryOn', () => {
    expect(hasEntryOn(entries, '2026-06-23')).toBe(true)
    expect(hasEntryOn(entries, '2026-06-25')).toBe(false)
  })
})

describe('sortByDateDesc', () => {
  test('newest first, original array untouched', () => {
    const entries = [{ date: '2026-06-20' }, { date: '2026-06-24' }, { date: '2026-06-22' }]
    expect(sortByDateDesc(entries).map(e => e.date)).toEqual(['2026-06-24', '2026-06-22', '2026-06-20'])
    expect(entries[0].date).toBe('2026-06-20') // not mutated
  })
})

describe('monthGrid', () => {
  test('June 2026 starts on a Monday, so the first cell is a trailing May day', () => {
    const grid = monthGrid(2026, 5)
    expect(grid[0]).toHaveLength(7)
    expect(grid[0][0].inMonth).toBe(false) // Sunday May 31
    expect(grid[0][1]).toMatchObject({ day: 1, inMonth: true, key: '2026-06-01' })
  })
  test('contains every day of the month, flagged inMonth', () => {
    const days = monthGrid(2026, 5).flat().filter(c => c.inMonth).map(c => c.day)
    expect(days).toEqual([...Array(30)].map((_, i) => i + 1)) // June has 30 days
  })
  test('weekStart=1 (Monday) puts June 1 (a Monday) in the first cell', () => {
    const grid = monthGrid(2026, 5, 1)
    expect(grid[0][0]).toMatchObject({ day: 1, inMonth: true, key: '2026-06-01' })
  })
  test('weekStart does not change which days belong to the month', () => {
    const sun = monthGrid(2026, 5, 0).flat().filter(c => c.inMonth).map(c => c.key)
    const mon = monthGrid(2026, 5, 1).flat().filter(c => c.inMonth).map(c => c.key)
    expect(mon).toEqual(sun)
  })
})

describe('stepMonth', () => {
  test('forward across a year boundary', () => {
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
  })
  test('backward across a year boundary', () => {
    expect(stepMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('entriesOnSameDay', () => {
  const entries = [
    { id: '1', date: '2026-06-24' },
    { id: '2', date: '2025-06-24' },
    { id: '3', date: '2024-06-24' },
    { id: '4', date: '2025-06-23' },
  ]
  test('finds same month+day in other years, excluding the key itself, newest first', () => {
    expect(entriesOnSameDay(entries, '2026-06-24').map(e => e.id)).toEqual(['2', '3'])
  })
  test('no matches returns empty', () => {
    expect(entriesOnSameDay(entries, '2026-01-01')).toEqual([])
  })
})

describe('yearGrid', () => {
  test('is Monday-aligned and contains all 365 days of 2026', () => {
    const weeks = yearGrid(2026)
    expect(weeks[0]).toHaveLength(7)
    const inYear = weeks.flat().filter(c => c.inYear)
    expect(inYear).toHaveLength(365)
    expect(inYear[0].key).toBe('2026-01-01')
    expect(inYear[inYear.length - 1].key).toBe('2026-12-31')
  })
})
