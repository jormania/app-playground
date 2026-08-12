// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { getDayRecord, recordFinishedGame, describeDay } from './sessionRun'

const TODAY = 'Wed Aug 12 2026'
const YESTERDAY = 'Tue Aug 11 2026'

describe('sessionRun', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(getDayRecord('standard', TODAY)).toEqual({ date: TODAY, played: 0, won: 0, run: 0, bestRun: 0 })
  })

  it('counts plays and wins', () => {
    recordFinishedGame('standard', true, TODAY)
    recordFinishedGame('standard', false, TODAY)
    expect(getDayRecord('standard', TODAY)).toMatchObject({ played: 2, won: 1 })
  })

  it('tracks a run of consecutive wins and resets it on a loss', () => {
    recordFinishedGame('standard', true, TODAY)
    recordFinishedGame('standard', true, TODAY)
    expect(getDayRecord('standard', TODAY).run).toBe(2)

    recordFinishedGame('standard', false, TODAY)
    expect(getDayRecord('standard', TODAY).run).toBe(0)
    // The best run of the day survives the loss that ended it.
    expect(getDayRecord('standard', TODAY).bestRun).toBe(2)
  })

  it('keeps each dictionary separate', () => {
    recordFinishedGame('standard', true, TODAY)
    recordFinishedGame('expert', false, TODAY)
    expect(getDayRecord('standard', TODAY)).toMatchObject({ played: 1, won: 1 })
    expect(getDayRecord('expert', TODAY)).toMatchObject({ played: 1, won: 0 })
  })

  it('resets when the day rolls over', () => {
    recordFinishedGame('standard', true, YESTERDAY)
    expect(getDayRecord('standard', YESTERDAY).played).toBe(1)
    // A "session" that survived a night's sleep wouldn't mean anything.
    expect(getDayRecord('standard', TODAY)).toMatchObject({ played: 0, run: 0 })
  })

  it('drops stale days rather than accumulating a record per day forever', () => {
    recordFinishedGame('standard', true, YESTERDAY)
    recordFinishedGame('expert', true, TODAY)
    const stored = JSON.parse(localStorage.getItem('lexi5_today'))
    expect(Object.keys(stored)).toEqual(['expert'])
  })

  it('describes the day only once there is something to say', () => {
    expect(describeDay(getDayRecord('standard', TODAY))).toBeNull()

    recordFinishedGame('standard', true, TODAY)
    expect(describeDay(getDayRecord('standard', TODAY))).toBe('1 of 1 solved today')

    // A "run" of one isn't a run.
    recordFinishedGame('standard', true, TODAY)
    expect(describeDay(getDayRecord('standard', TODAY))).toBe('2 of 2 solved today · 2 in a row')
  })
})
