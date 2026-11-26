import { describe, expect, it } from 'vitest'
import { reminderIcs } from './ics'

describe('a due-date reminder', () => {
  const r = { id: 'p1', description: 'Workshop; Q1, part 2', amount: 1200, currency: 'EUR' as const, date: '2026-12-31', notes: 'Invoice 14\nsecond line' }
  const ics = reminderIcs(r, 'Verdant Labs', new Date('2026-11-26T10:00:00Z'))
  it('is one all-day event on the due date, with a reminder that morning', () => {
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n')
    expect(ics).toContain('TRIGGER:PT9H')
    expect(ics).toContain('DTSTAMP:20261126T100000Z')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })
  it('escapes text as the format asks, and folds long lines', () => {
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('Workshop\\; Q1\\, part 2')
    expect(unfolded).toContain('Invoice 14\\nsecond line')
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })
})
