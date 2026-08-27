import { describe, it, expect } from 'vitest'
import { toProductions, domIdForDay, nextDayKeys, densityForDays } from './programme.js'

// programme.js's other functions (byDate, visibleProductions, the filter
// helpers) are exercised through Programme.jsx/App.jsx's own tests. These
// three are new (the week strip) and pure enough to test directly.

const event = (over = {}) => ({
  key: over.key ?? 'k', venue: 'Excelsior', title: 'Tomcat', date: '2026-09-05',
  time: null, ticketState: 'none', hall: null, link: null, image: null, price: null, ...over,
})

describe('domIdForDay', () => {
  it('is a stable, distinct id per calendar day', () => {
    expect(domIdForDay('2026-09-05')).toBe('day-2026-09-05')
    expect(domIdForDay('2026-09-06')).not.toBe(domIdForDay('2026-09-05'))
  })
})

describe('nextDayKeys', () => {
  it('starts today and runs `count` calendar days, local not UTC', () => {
    const now = new Date(2026, 8, 5, 23, 30) // 5 Sep 2026, 23:30 local
    expect(nextDayKeys(now, 3)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07'])
  })

  it('rolls across a month boundary correctly', () => {
    const now = new Date(2026, 8, 29) // 29 Sep 2026
    expect(nextDayKeys(now, 3)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01'])
  })
})

describe('densityForDays', () => {
  it('counts a production on EVERY date it shows, not only its first', () => {
    // A three-night run should light up all three days in the strip — the
    // whole point of not reusing byDate's first-date-only grouping.
    const run = toProductions([
      event({ key: 'a', date: '2026-09-05' }),
      event({ key: 'b', date: '2026-09-06' }),
      event({ key: 'c', date: '2026-09-07' }),
    ])
    const density = densityForDays(run, ['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08'])
    expect(density).toEqual([
      { date: '2026-09-05', count: 1 },
      { date: '2026-09-06', count: 1 },
      { date: '2026-09-07', count: 1 },
      { date: '2026-09-08', count: 0 },
    ])
  })

  it('counts distinct productions, not distinct showings, on a busy day', () => {
    const two = toProductions([
      event({ key: 'a', title: 'Tomcat', date: '2026-09-05', time: '17:00' }),
      event({ key: 'b', title: 'Tomcat', date: '2026-09-05', time: '20:00' }), // same production, two showings
      event({ key: 'c', title: 'Solaris', date: '2026-09-05' }),
    ])
    expect(densityForDays(two, ['2026-09-05'])).toEqual([{ date: '2026-09-05', count: 2 }])
  })

  it('is all zeros against an empty production list', () => {
    expect(densityForDays([], ['2026-09-05', '2026-09-06'])).toEqual([
      { date: '2026-09-05', count: 0 },
      { date: '2026-09-06', count: 0 },
    ])
  })
})
