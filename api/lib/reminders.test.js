import { test, expect, describe } from 'vitest'
import { addDays, zonedTodayKey, zonedTomorrowKey, selectExpiring, buildReminderEmail } from './reminders.js'

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

describe('selectExpiring', () => {
  const items = [
    { name: 'A', attended: false, dateExpiring: '2026-07-09' },
    { name: 'B', attended: true, dateExpiring: '2026-07-09' },   // attended → skip
    { name: 'C', attended: false, dateExpiring: '2026-07-10' },  // wrong day → skip
    { name: 'D', attended: false, dateExpiring: null },          // no deadline → skip
    { name: 'E', attended: false, dateExpiring: '2026-07-09' },
  ]
  test('only unattended items expiring exactly on the target day', () => {
    expect(selectExpiring(items, '2026-07-09').map(i => i.name)).toEqual(['A', 'E'])
    expect(selectExpiring(items, '')).toEqual([])
  })
})

describe('buildReminderEmail', () => {
  test('singular subject names the item; greeting uses the name', () => {
    const { subject, text, html } = buildReminderEmail(
      [{ name: 'Jazz', place: 'Uranus', link: 'https://x' }],
      { name: 'Gabe', tomorrowKey: '2026-07-09' }
    )
    expect(subject).toBe('Wanderlist: “Jazz” expires tomorrow')
    expect(text).toContain('Hi Gabe,')
    expect(text).toContain('Jazz')
    expect(html).toContain('href="https://x"')
  })
  test('plural subject counts the items', () => {
    const { subject } = buildReminderEmail(
      [{ name: 'A' }, { name: 'B' }], { tomorrowKey: '2026-07-09' }
    )
    expect(subject).toBe('Wanderlist: 2 things expire tomorrow')
  })
  test('escapes HTML in names', () => {
    const { html } = buildReminderEmail([{ name: 'A & <b>B</b>' }], {})
    expect(html).toContain('A &amp; &lt;b&gt;B&lt;/b&gt;')
  })
})
