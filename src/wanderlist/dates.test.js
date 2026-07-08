import { test, expect, describe } from 'vitest'
import { daysUntil, expiryLabel, isExpiringSoon, isPastExpired, isPlannedPast, formatMedium, monthGrid, stepMonth, entriesOnDay } from './dates.js'

describe('daysUntil', () => {
  test('counts whole calendar days, signed', () => {
    expect(daysUntil('2026-07-10', '2026-07-08')).toBe(2)
    expect(daysUntil('2026-07-08', '2026-07-08')).toBe(0)
    expect(daysUntil('2026-07-05', '2026-07-08')).toBe(-3)
    expect(daysUntil(null, '2026-07-08')).toBe(null)
  })
})

describe('expiryLabel', () => {
  const today = '2026-07-08'
  test('phrases relative to today', () => {
    expect(expiryLabel('2026-07-08', today)).toBe('expires today')
    expect(expiryLabel('2026-07-09', today)).toBe('expires tomorrow')
    expect(expiryLabel('2026-07-13', today)).toBe('expires in 5 days')
    expect(expiryLabel('2026-07-07', today)).toBe('expired yesterday')
    expect(expiryLabel('2026-07-05', today)).toBe('expired 3 days ago')
    expect(expiryLabel(null, today)).toBe('')
  })
})

describe('isExpiringSoon', () => {
  const today = '2026-07-08'
  test('unattended, within window, not past', () => {
    expect(isExpiringSoon({ attended: false, dateExpiring: '2026-07-10' }, { today })).toBe(true)
    expect(isExpiringSoon({ attended: false, dateExpiring: '2026-07-30' }, { today, days: 14 })).toBe(false)
    expect(isExpiringSoon({ attended: true, dateExpiring: '2026-07-10' }, { today })).toBe(false)
    expect(isExpiringSoon({ attended: false, dateExpiring: '2026-07-01' }, { today })).toBe(false) // past
    expect(isExpiringSoon({ attended: false, dateExpiring: null }, { today })).toBe(false)
  })
})

describe('isPastExpired', () => {
  const today = '2026-07-08'
  test('unattended and the deadline has already passed', () => {
    expect(isPastExpired({ attended: false, dateExpiring: '2026-07-05' }, today)).toBe(true)
    expect(isPastExpired({ attended: false, dateExpiring: '2026-07-08' }, today)).toBe(false) // today isn't past yet
    expect(isPastExpired({ attended: false, dateExpiring: '2026-07-10' }, today)).toBe(false)
    expect(isPastExpired({ attended: true, dateExpiring: '2026-07-05' }, today)).toBe(false) // attended sinks no more
    expect(isPastExpired({ attended: false, dateExpiring: null }, today)).toBe(false)
  })
})

describe('isPlannedPast', () => {
  const today = '2026-07-08'
  test('unattended and the planned date has slipped by', () => {
    expect(isPlannedPast({ attended: false, plannedDate: '2026-07-01' }, today)).toBe(true)
    expect(isPlannedPast({ attended: false, plannedDate: '2026-07-08' }, today)).toBe(false)
    expect(isPlannedPast({ attended: true, plannedDate: '2026-07-01' }, today)).toBe(false)
    expect(isPlannedPast({ attended: false, plannedDate: null }, today)).toBe(false)
  })
})

describe('formatMedium', () => {
  test('compact, year-unambiguous', () => {
    expect(formatMedium('2026-07-11')).toBe('11 Jul 2026')
    expect(formatMedium(null)).toBe('')
  })
})

describe('monthGrid (Monday-start)', () => {
  test('rectangular weeks starting on a Monday, containing the month', () => {
    const weeks = monthGrid(2026, 6, 1) // July 2026 (July 1 is a Wednesday)
    expect(weeks.every(w => w.length === 7)).toBe(true)
    expect(weeks[0][0].key).toBe('2026-06-29') // the Monday before July 1
    const jul1 = weeks.flat().find(c => c.key === '2026-07-01')
    expect(jul1.inMonth).toBe(true)
    expect(weeks.flat().find(c => c.key === '2026-06-29').inMonth).toBe(false)
  })
})

describe('stepMonth', () => {
  test('wraps the year', () => {
    expect(stepMonth({ year: 2026, month: 6 }, 1)).toEqual({ year: 2026, month: 7 })
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(stepMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('entriesOnDay', () => {
  const entries = [
    { id: 'a', plannedDate: '2026-07-11', dateExpiring: '2026-07-10' },
    { id: 'b', plannedDate: null, dateExpiring: '2026-07-11' },
    { id: 'c', plannedDate: '2026-07-12', dateExpiring: null },
  ]
  test('tags each match with its role(s); planned first; date can hit both', () => {
    expect(entriesOnDay(entries, '2026-07-11')).toEqual([
      { entry: entries[0], planned: true, expiring: false },
      { entry: entries[1], planned: false, expiring: true },
    ])
    expect(entriesOnDay(entries, '2026-07-10')).toEqual([
      { entry: entries[0], planned: false, expiring: true },
    ])
    expect(entriesOnDay(entries, '2026-07-20')).toEqual([])
  })
})
