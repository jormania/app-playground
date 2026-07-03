import { describe, it, expect } from 'vitest'
import { onThisDayMatches, computeReminderState } from './reminders.js'

const entries = [
  { id: '1', date: '2024-07-12', title: 'the espresso foam' },
  { id: '2', date: '2025-07-12', title: 'a stranger held the door' },
  { id: '3', date: '2026-07-11', title: 'not today' },
]

describe('onThisDayMatches', () => {
  it('finds past entries sharing the same month + day, any year', () => {
    const matches = onThisDayMatches(entries, new Date(2026, 6, 12))
    expect(matches).toEqual([
      { date: '2025-07-12', title: 'a stranger held the door' },
      { date: '2024-07-12', title: 'the espresso foam' },
    ])
  })
  it('is empty with no match', () => {
    expect(onThisDayMatches(entries, new Date(2026, 0, 1))).toEqual([])
  })
  it('falls back to "untitled" for a titleless entry', () => {
    const matches = onThisDayMatches([{ id: '9', date: '2020-03-04', title: '' }], new Date(2026, 2, 4))
    expect(matches).toEqual([{ date: '2020-03-04', title: 'untitled' }])
  })
})

describe('computeReminderState', () => {
  const now = new Date(2026, 6, 12)
  it('marks todayLogged when today already has an entry', () => {
    const withToday = [...entries, { id: '4', date: '2026-07-12', title: 'today' }]
    const state = computeReminderState(withToday, { enabled: true, date: now })
    expect(state.todayLogged).toBe('2026-07-12')
  })
  it('leaves todayLogged empty when nothing is written yet today', () => {
    const state = computeReminderState(entries, { enabled: true, date: now })
    expect(state.todayLogged).toBe('')
  })
  it('carries onThisDay matches and the enabled flag through', () => {
    const state = computeReminderState(entries, { enabled: true, date: now })
    expect(state.enabled).toBe(true)
    expect(state.onThisDay).toHaveLength(2)
  })
  it('defaults enabled to false when not passed', () => {
    expect(computeReminderState(entries, { date: now }).enabled).toBe(false)
  })
  it('defaults per-type wants to true, carries them through when set', () => {
    expect(computeReminderState(entries, { date: now }).wantNudge).toBe(true)
    expect(computeReminderState(entries, { date: now }).wantOnThisDay).toBe(true)
    const state = computeReminderState(entries, { date: now, wantNudge: false, wantOnThisDay: false })
    expect(state.wantNudge).toBe(false)
    expect(state.wantOnThisDay).toBe(false)
  })
})
