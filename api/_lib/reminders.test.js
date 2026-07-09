import { test, expect, describe } from 'vitest'
import {
  addDays, zonedTodayKey, zonedTomorrowKey, zonedHour,
  splitPlannedStart, formatTime12, statusesFor, selectDueTomorrow, buildReminderEmail,
} from './reminders.js'

describe('addDays', () => {
  test('advances a key, crossing month/year and DST safely', () => {
    expect(addDays('2026-07-08', 1)).toBe('2026-07-09')
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // EU DST change day
  })
})

describe('zoned today/tomorrow (Europe/Bucharest)', () => {
  test('resolves the local calendar day, not UTC', () => {
    // 22:30 UTC on Jul 8 is already 01:30 Jul 9 in Bucharest (UTC+3 in summer).
    const lateUtc = new Date('2026-07-08T22:30:00Z')
    expect(zonedTodayKey(lateUtc, 'Europe/Bucharest')).toBe('2026-07-09')
    expect(zonedTomorrowKey(lateUtc, 'Europe/Bucharest')).toBe('2026-07-10')
    // Mid-morning UTC stays on the same day.
    const morningUtc = new Date('2026-07-08T09:00:00Z')
    expect(zonedTomorrowKey(morningUtc, 'Europe/Bucharest')).toBe('2026-07-09')
  })
})

describe('zonedHour', () => {
  test('resolves the local hour, both DST offsets', () => {
    // Summer (EEST, UTC+3): 16:00 UTC -> 19:00 local.
    expect(zonedHour(new Date('2026-07-08T16:00:00Z'), 'Europe/Bucharest')).toBe(19)
    // Winter (EET, UTC+2): 17:00 UTC -> 19:00 local.
    expect(zonedHour(new Date('2026-01-08T17:00:00Z'), 'Europe/Bucharest')).toBe(19)
    // The "wrong" cron entry for the season resolves to a different hour, not 19.
    expect(zonedHour(new Date('2026-07-08T17:00:00Z'), 'Europe/Bucharest')).toBe(20)
  })
})

describe('splitPlannedStart', () => {
  test('splits a datetime into date + time; a bare date has no time; empty is null/null', () => {
    expect(splitPlannedStart('2026-07-12T19:30:00.000+03:00')).toEqual({ date: '2026-07-12', time: '19:30' })
    expect(splitPlannedStart('2026-07-12')).toEqual({ date: '2026-07-12', time: null })
    expect(splitPlannedStart(null)).toEqual({ date: null, time: null })
  })
})

describe('formatTime12', () => {
  test('renders 24h HH:MM as a compact 12h string', () => {
    expect(formatTime12('19:30')).toBe('7:30pm')
    expect(formatTime12('00:05')).toBe('12:05am')
    expect(formatTime12('12:00')).toBe('12:00pm')
    expect(formatTime12(null)).toBe('')
    expect(formatTime12('nope')).toBe('')
  })
})

describe('statusesFor', () => {
  const day = '2026-07-09'
  test('expiring, planned (undecided), and planned+going are distinct', () => {
    expect(statusesFor({ dateExpiring: day }, day)).toEqual(['expiring'])
    expect(statusesFor({ plannedDate: day, going: false }, day)).toEqual(['planned'])
    expect(statusesFor({ plannedDate: day, going: true }, day)).toEqual(['going'])
    expect(statusesFor({ dateExpiring: day, plannedDate: day, going: true }, day)).toEqual(['expiring', 'going'])
    expect(statusesFor({ dateExpiring: '2026-07-10' }, day)).toEqual([])
  })
})

describe('selectDueTomorrow', () => {
  const items = [
    { name: 'A', attended: false, dateExpiring: '2026-07-09' },                          // expiring
    { name: 'B', attended: true, dateExpiring: '2026-07-09' },                            // attended -> skip
    { name: 'C', attended: false, dateExpiring: '2026-07-10' },                           // wrong day -> skip
    { name: 'D', attended: false, dateExpiring: null, plannedDate: null },                // nothing due -> skip
    { name: 'E', attended: false, plannedDate: '2026-07-09', going: false },              // planned, undecided
    { name: 'F', attended: false, plannedDate: '2026-07-09', going: true },               // going
    { name: 'G', attended: true, plannedDate: '2026-07-09', going: true },                // attended -> skip, even though going
  ]
  test('unattended items due tomorrow via Expiring, Planned, or Going, each labelled', () => {
    const due = selectDueTomorrow(items, '2026-07-09')
    expect(due.map(i => i.name)).toEqual(['A', 'E', 'F'])
    expect(due.find(i => i.name === 'A').statuses).toEqual(['expiring'])
    expect(due.find(i => i.name === 'E').statuses).toEqual(['planned'])
    expect(due.find(i => i.name === 'F').statuses).toEqual(['going'])
  })
  test('empty day key -> nothing', () => {
    expect(selectDueTomorrow(items, '')).toEqual([])
  })
})

describe('buildReminderEmail', () => {
  test('singular subject explains the status; greeting uses the name', () => {
    const { subject, text, html } = buildReminderEmail(
      [{ name: 'Jazz', place: 'Uranus', link: 'https://x', statuses: ['expiring'] }],
      { name: 'Gabe' }
    )
    expect(subject).toBe('Wanderlist: “Jazz” — expires tomorrow')
    expect(text).toContain('Hi Gabe,')
    expect(text).toContain('Jazz')
    expect(html).toContain('href="https://x"')
    expect(html).toContain('expires tomorrow')
  })
  test('plural subject counts the items', () => {
    const { subject } = buildReminderEmail(
      [{ name: 'A', statuses: ['expiring'] }, { name: 'B', statuses: ['planned'] }], {}
    )
    expect(subject).toBe('Wanderlist: 2 things tomorrow')
  })
  test('going items explain the time; planned-undecided items say so', () => {
    const { text } = buildReminderEmail([
      { name: 'Concert', statuses: ['going'], plannedTime: '19:30' },
      { name: 'Museum', statuses: ['planned'] },
    ], {})
    expect(text).toContain('you’re going tomorrow at 7:30pm')
    expect(text).toContain('planned for tomorrow — you haven’t said you’re going yet')
  })
  test('an item due under two statuses explains both', () => {
    const { text } = buildReminderEmail([{ name: 'Both', statuses: ['expiring', 'going'], plannedTime: '09:00' }], {})
    expect(text).toContain('expires tomorrow · you’re going tomorrow at 9:00am')
  })
  test('escapes HTML in names', () => {
    const { html } = buildReminderEmail([{ name: 'A & <b>B</b>', statuses: ['expiring'] }], {})
    expect(html).toContain('A &amp; &lt;b&gt;B&lt;/b&gt;')
  })
})
