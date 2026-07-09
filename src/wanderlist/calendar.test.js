import { test, expect, describe } from 'vitest'
import { calendarDates, googleCalendarUrl } from './calendar.js'

describe('calendarDates', () => {
  test('no planned date -> null (let the user pick in Google)', () => {
    expect(calendarDates({ plannedDate: null })).toBeNull()
    expect(calendarDates({})).toBeNull()
  })
  test('planned date, no time -> all-day with exclusive next-day end', () => {
    expect(calendarDates({ plannedDate: '2026-07-11' })).toBe('20260711/20260712')
    // month/year roll over correctly
    expect(calendarDates({ plannedDate: '2026-12-31' })).toBe('20261231/20270101')
  })
  test('planned date + time -> a timed UTC block of the default 2h', () => {
    const d = calendarDates({ plannedDate: '2026-07-11', plannedTime: '19:30' })
    // start/end are UTC 'YYYYMMDDTHHMMSSZ' and exactly 2h apart; exact hour depends on the
    // runner's tz, so assert the shape + the 2h gap rather than a fixed clock value.
    expect(d).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    const [start, end] = d.split('/')
    const toDate = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`)
    expect(toDate(end).getTime() - toDate(start).getTime()).toBe(2 * 3600 * 1000)
  })
  test('a malformed time falls back to an all-day range', () => {
    expect(calendarDates({ plannedDate: '2026-07-11', plannedTime: 'nonsense' })).toBe('20260711/20260712')
  })
})

describe('googleCalendarUrl', () => {
  test('always sets action=TEMPLATE and the title', () => {
    const url = new URL(googleCalendarUrl({ name: 'Jazz night' }))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Jazz night')
  })
  test('folds description + link into details, place into location', () => {
    const url = new URL(googleCalendarUrl({ name: 'X', description: 'shorts + gala', link: 'https://x', place: 'Cinema Pro' }))
    expect(url.searchParams.get('details')).toBe('shorts + gala\n\nhttps://x')
    expect(url.searchParams.get('location')).toBe('Cinema Pro')
  })
  test('omits dates when there is no planned date; includes them when there is', () => {
    expect(new URL(googleCalendarUrl({ name: 'idea' })).searchParams.get('dates')).toBeNull()
    expect(new URL(googleCalendarUrl({ name: 'x', plannedDate: '2026-07-11' })).searchParams.get('dates')).toBe('20260711/20260712')
  })
  test('untitled fallback', () => {
    expect(new URL(googleCalendarUrl({})).searchParams.get('text')).toBe('Untitled')
  })
})
