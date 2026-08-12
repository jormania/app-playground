// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDayRecord, recordFinishedGame, describeDay } from './sessionRun'

// The module deliberately exposes no date parameter — it always files under the current
// day, because it records *when you played*, not which puzzle. So the clock is what these
// tests move, rather than passing a date in (which is exactly the footgun that let an
// archived game wipe the current day's record).
const setDay = (y, m, d) => vi.setSystemTime(new Date(y, m, d, 12, 0, 0))

describe('sessionRun', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    setDay(2026, 7, 12)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts empty', () => {
    expect(getDayRecord('standard')).toMatchObject({ played: 0, won: 0, run: 0, bestRun: 0 })
  })

  it('counts plays and wins', () => {
    recordFinishedGame('standard', true)
    recordFinishedGame('standard', false)
    expect(getDayRecord('standard')).toMatchObject({ played: 2, won: 1 })
  })

  it('tracks a run of consecutive wins and resets it on a loss', () => {
    recordFinishedGame('standard', true)
    recordFinishedGame('standard', true)
    expect(getDayRecord('standard').run).toBe(2)

    recordFinishedGame('standard', false)
    expect(getDayRecord('standard').run).toBe(0)
    // The best run of the day survives the loss that ended it.
    expect(getDayRecord('standard').bestRun).toBe(2)
  })

  it('keeps each dictionary separate', () => {
    recordFinishedGame('standard', true)
    recordFinishedGame('expert', false)
    expect(getDayRecord('standard')).toMatchObject({ played: 1, won: 1 })
    expect(getDayRecord('expert')).toMatchObject({ played: 1, won: 0 })
  })

  it('resets when the day rolls over', () => {
    recordFinishedGame('standard', true)
    recordFinishedGame('standard', true)
    expect(getDayRecord('standard')).toMatchObject({ played: 2, run: 2 })

    setDay(2026, 7, 13)
    // A "session" that survived a night's sleep wouldn't mean anything.
    expect(getDayRecord('standard')).toMatchObject({ played: 0, run: 0 })
  })

  it('drops stale days rather than accumulating a record per day forever', () => {
    recordFinishedGame('standard', true)
    setDay(2026, 7, 13)
    recordFinishedGame('expert', true)
    expect(Object.keys(JSON.parse(localStorage.getItem('lexi5_today')))).toEqual(['expert'])
  })

  it("files a game under the day it was played, not the day's puzzle it was", () => {
    // Regression: finishing an archived day used to be recorded against that past date,
    // and the prune step then discarded every record that didn't match it — silently
    // wiping the run the player had built up today.
    recordFinishedGame('standard', true)
    recordFinishedGame('standard', true)
    expect(getDayRecord('standard').run).toBe(2)

    // Playing a two-week-old puzzle right now is still a game played *today*.
    recordFinishedGame('standard', true)
    expect(getDayRecord('standard')).toMatchObject({ played: 3, run: 3 })
  })

  it('describes the day only once there is something to say', () => {
    expect(describeDay(getDayRecord('standard'))).toBeNull()

    recordFinishedGame('standard', true)
    expect(describeDay(getDayRecord('standard'))).toBe('1 of 1 solved today')

    // A "run" of one isn't a run.
    recordFinishedGame('standard', true)
    expect(describeDay(getDayRecord('standard'))).toBe('2 of 2 solved today · 2 in a row')
  })
})
