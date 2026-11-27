import { describe, expect, it } from 'vitest'
import { addDays, beads, runOf } from './streak'

describe('a string of days', () => {
  it('counts the days in a row up to today, kept open through today until she plays', () => {
    expect(runOf(['2026-11-25', '2026-11-26', '2026-11-27'], '2026-11-27')).toEqual({ current: 3, playedToday: true, best: 3 })
    // Not played yet today: yesterday's string is still hers to carry on.
    expect(runOf(['2026-11-25', '2026-11-26'], '2026-11-27')).toEqual({ current: 2, playedToday: false, best: 2 })
    // A day missed: a new string, and the longest one kept.
    expect(runOf(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-26'], '2026-11-27')).toEqual({ current: 1, playedToday: false, best: 3 })
    expect(runOf([], '2026-11-27')).toEqual({ current: 0, playedToday: false, best: 0 })
  })

  it('crosses months, years and the clock change', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(runOf(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26').current).toBe(3) // 25 Oct: summer time ends
  })

  it('draws the last days as beads, the ones in a row joined', () => {
    const b = beads(['2026-11-25', '2026-11-26', '2026-11-27'], '2026-11-27', 4)
    expect(b.map((x) => [x.date.slice(8), x.played, x.joined, x.today])).toEqual([
      ['24', false, false, false],
      ['25', true, false, false],
      ['26', true, true, false],
      ['27', true, true, true],
    ])
  })
})
