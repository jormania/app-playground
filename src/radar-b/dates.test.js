import { describe, test, expect } from 'vitest'
import { weekendRange, endOfWeek, lensesFor, isLongRun, isRunningNow, isPast, formatWhen, dayHeading, dayKey, stalenessDays, relativeDays } from './dates.js'
import { normalizeEvent } from './model.js'

const ev = (over) => normalizeEvent({ name: 'x', ...over })
// A fixed reference point: Wednesday 2026-08-19, 15:00 local.
const WED = new Date(2026, 7, 19, 15, 0)

describe('weekendRange', () => {
  test('midweek looks forward to the coming Friday–Sunday', () => {
    const { from, to } = weekendRange(WED)
    expect(dayKey(from)).toBe('2026-08-21')
    expect(dayKey(to)).toBe('2026-08-23')
  })

  test('on a Saturday it means THIS weekend, not next', () => {
    const sat = new Date(2026, 7, 22, 11, 0)
    expect(dayKey(weekendRange(sat).from)).toBe('2026-08-21')
  })

  test('on a Sunday it still means the weekend you are in', () => {
    const sun = new Date(2026, 7, 23, 11, 0)
    expect(dayKey(weekendRange(sun).from)).toBe('2026-08-21')
    expect(dayKey(weekendRange(sun).to)).toBe('2026-08-23')
  })
})

describe('endOfWeek', () => {
  test('is the Sunday of the calendar week you are in, not today+7', () => {
    // The bug this replaces: a rolling seven days from Friday 21st swept in the
    // FOLLOWING weekend (a festival on the 28th showed under "this week").
    expect(dayKey(endOfWeek(WED))).toBe('2026-08-23')
    expect(dayKey(endOfWeek(new Date(2026, 7, 21)))).toBe('2026-08-23') // Friday
    expect(dayKey(endOfWeek(new Date(2026, 7, 23)))).toBe('2026-08-23') // Sunday: itself
    expect(dayKey(endOfWeek(new Date(2026, 7, 24)))).toBe('2026-08-30') // Monday: next Sunday
  })
})

describe('lensesFor', () => {
  test('"this week" stops at Sunday — next weekend is "later", not "this week"', () => {
    const friday = new Date(2026, 7, 21, 12, 0)
    const nextWeekend = ev({ start: '2026-08-28', end: '2026-08-30' })
    expect(lensesFor(nextWeekend, friday).has('week')).toBe(false)
    expect(lensesFor(nextWeekend, friday).has('later')).toBe(true)

    const thisSunday = ev({ start: '2026-08-23' })
    expect(lensesFor(thisSunday, friday).has('week')).toBe(true)
  })

  test('an event tonight is in tonight and this week', () => {
    const l = lensesFor(ev({ start: '2026-08-19', hasTime: false }), WED)
    expect([...l].sort()).toEqual(['tonight', 'week'])
  })

  test('a festival spanning the weekend answers to several lenses at once', () => {
    // The point of returning a SET: forcing one bucket is how calendars lose things.
    const l = lensesFor(ev({ start: '2026-08-21', end: '2026-08-23' }), WED)
    expect(l.has('weekend')).toBe(true)
    expect(l.has('week')).toBe(true)
    expect(l.has('tonight')).toBe(false)
  })

  test('a past event is in no lens at all', () => {
    expect(lensesFor(ev({ start: '2026-08-01' }), WED).size).toBe(0)
  })

  test('an undated event sits at the back, in "later"', () => {
    expect([...lensesFor(ev({ start: null }), WED)]).toEqual(['later'])
  })

  test('an exhibition opening in the future reaches beyond the week into later', () => {
    const l = lensesFor(ev({ start: '2026-08-27', end: '2026-11-01' }), WED)
    expect(l.has('week')).toBe(false)
    expect(l.has('later')).toBe(true)
  })

  test('an exhibition already running is not "later" — that would say wait about something open today', () => {
    // Its one dedicated home is `running` (isRunningNow), checked separately by
    // search.js's inView — this is what keeps the Later and Running tabs from
    // showing the exact same card under the exact same "Oricând" heading.
    const l = lensesFor(ev({ start: '2026-08-19', end: '2026-11-01' }), WED)
    expect(l.has('tonight')).toBe(true) // still legitimately "on tonight"
    expect(l.has('later')).toBe(false)
  })
})

describe('long runs', () => {
  test('a four-day-plus span is a long run', () => {
    // Eight days — "still on in a week", so it spans another weekend.
    expect(isLongRun(ev({ start: '2026-08-19', end: '2026-08-26' }))).toBe(true)
    expect(isLongRun(ev({ start: '2026-08-01', end: '2026-11-01' }))).toBe(true)
    expect(isLongRun(ev({ start: '2026-08-19', end: '2026-08-20' }))).toBe(false)
    expect(isLongRun(ev({ start: '2026-08-19' }))).toBe(false)

    // A five-day cinema run is NOT something you can see "oricând" — it leaves
    // this week. It belongs in the day stream, not in the standing section.
    expect(isLongRun(ev({ start: '2026-08-26', end: '2026-08-30' }))).toBe(false)
    // Nor is a long weekend festival.
    expect(isLongRun(ev({ start: '2026-08-28', end: '2026-08-30' }))).toBe(false)
  })

  test('running now means a long run whose span contains today', () => {
    expect(isRunningNow(ev({ start: '2026-08-01', end: '2026-11-01' }), WED)).toBe(true)
    expect(isRunningNow(ev({ start: '2026-09-01', end: '2026-11-01' }), WED)).toBe(false)
    // A single-evening concert today is not "running" — it's tonight.
    expect(isRunningNow(ev({ start: '2026-08-19' }), WED)).toBe(false)
  })
})

describe('isPast', () => {
  test('an event ending yesterday is past; one ending today is not', () => {
    expect(isPast(ev({ start: '2026-08-18' }), WED)).toBe(true)
    expect(isPast(ev({ start: '2026-08-19' }), WED)).toBe(false)
    expect(isPast(ev({ start: '2026-07-01', end: '2026-08-19' }), WED)).toBe(false)
  })
})

describe('formatWhen', () => {
  test('speaks in days, not dates, for the near future', () => {
    expect(formatWhen(ev({ start: '2026-08-19' }), WED)).toBe('azi')
    expect(formatWhen(ev({ start: '2026-08-20' }), WED)).toBe('mâine')
    expect(formatWhen(ev({ start: '2026-08-22' }), WED)).toBe('sâmbătă')
  })

  test('adds a time only when the time is actually known', () => {
    expect(formatWhen(ev({ start: '2026-08-19T21:00:00', hasTime: true }), WED)).toBe('azi, 21:00')
    expect(formatWhen(ev({ start: '2026-08-19', hasTime: false }), WED)).toBe('azi')
  })

  test('a run in progress is described by when it closes', () => {
    expect(formatWhen(ev({ start: '2026-07-01', end: '2026-11-01' }), WED)).toBe('până pe 1 noiembrie')
  })

  test('a future run is described by its span', () => {
    expect(formatWhen(ev({ start: '2026-09-01', end: '2026-09-05' }), WED)).toBe('1 septembrie – 5 septembrie')
  })

  test('an undated event says so rather than guessing', () => {
    expect(formatWhen(ev({ start: null }), WED)).toBe('fără dată')
  })
})

describe('dayHeading', () => {
  test('names today and tomorrow, then falls back to weekday', () => {
    expect(dayHeading('2026-08-19', WED)).toBe('Azi · 19 august')
    expect(dayHeading('2026-08-20', WED)).toBe('Mâine · 20 august')
    expect(dayHeading('2026-08-22', WED)).toBe('Sâmbătă · 22 august')
  })
})

describe('staleness', () => {
  test('counts days since the row was last verified', () => {
    expect(stalenessDays(ev({ checked: '2026-08-19' }), WED)).toBe(0)
    expect(stalenessDays(ev({ checked: '2026-08-12' }), WED)).toBe(7)
  })

  test('never checked is null, not zero — unknown must not read as fresh', () => {
    expect(stalenessDays(ev({ checked: null }), WED)).toBeNull()
    expect(relativeDays(null)).toBeNull()
  })

  test('phrases the gap in Romanian', () => {
    expect(relativeDays(0)).toBe('azi')
    expect(relativeDays(1)).toBe('ieri')
    expect(relativeDays(5)).toBe('acum 5 zile')
  })
})

describe('dayKey', () => {
  test('is built from local parts, so a late-night event stays on its own day', () => {
    // toISOString() would shift a 00:30 Bucharest time back to the previous day.
    expect(dayKey(new Date(2026, 7, 19, 0, 30))).toBe('2026-08-19')
    expect(dayKey(new Date(2026, 7, 19, 23, 30))).toBe('2026-08-19')
  })
})
