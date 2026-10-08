import { describe, it, expect } from 'vitest'
import { weekOf, weekFromKey, weeksBetween, sinceWords, civilDateIn } from './week'

describe('the listening week', () => {
  it('turns over at Monday midnight in Bucharest, not in UTC', () => {
    // Sunday 11 Oct 2026, 23:30 in Bucharest (EEST, UTC+3) is 20:30 UTC.
    expect(weekOf(new Date('2026-10-11T20:30:00Z')).key).toBe('2026-W41')
    // Monday 00:30 in Bucharest is still Sunday 21:30 UTC — already the new week.
    expect(weekOf(new Date('2026-10-11T21:30:00Z')).key).toBe('2026-W42')
  })

  it('does not depend on which zone the code happens to run in', () => {
    const instant = new Date('2026-10-11T21:30:00Z')
    expect(weekOf(instant, 'Europe/Bucharest').key).toBe('2026-W42')
    expect(weekOf(instant, 'UTC').key).toBe('2026-W41')
    expect(weekOf(instant, 'America/New_York').key).toBe('2026-W41')
  })

  it('holds across the autumn clock change', () => {
    // Clocks go back on Sunday 25 Oct 2026 in Bucharest (UTC+3 → UTC+2).
    expect(weekOf(new Date('2026-10-25T21:59:00Z')).key).toBe('2026-W43') // Sun 23:59 EET
    expect(weekOf(new Date('2026-10-25T22:00:00Z')).key).toBe('2026-W44') // Mon 00:00 EET
  })

  it('numbers ISO weeks across a year boundary', () => {
    // 1 Jan 2027 is a Friday, so it belongs to 2026's last week.
    expect(weekOf(new Date('2027-01-01T10:00:00Z')).key).toBe('2026-W53')
    expect(weekOf(new Date('2027-01-04T10:00:00Z')).key).toBe('2027-W01')
  })

  it('labels the week the way a programme would', () => {
    const w = weekOf(new Date('2026-10-08T09:00:00Z'))
    expect(w).toMatchObject({ key: '2026-W41', startsOn: '2026-10-05', endsOn: '2026-10-11', label: '5–11 October 2026' })
    expect(weekOf(new Date('2026-09-30T09:00:00Z')).label).toBe('28 September – 4 October 2026')
  })

  it('round-trips a key', () => {
    expect(weekFromKey('2026-W41').startsOn).toBe('2026-10-05')
    expect(weekFromKey('2026-W53').endsOn).toBe('2027-01-03')
    expect(() => weekFromKey('nonsense')).toThrow()
  })

  it('speaks about elapsed time in words, not counts', () => {
    expect(weeksBetween('2026-W35', '2026-W41')).toBe(6)
    expect(sinceWords('2026-W35', '2026-W41')).toBe('six weeks ago')
    expect(sinceWords('2026-W40', '2026-W41')).toBe('last week')
    expect(sinceWords('2026-W12', '2026-W41')).toBe('in March')
    expect(sinceWords('2025-W12', '2026-W41')).toBe('in March 2025')
  })

  it('reads the civil date in the given zone', () => {
    expect(civilDateIn(new Date('2026-10-11T21:30:00Z'), 'Europe/Bucharest')).toEqual({ year: 2026, month: 10, day: 12 })
  })
})
