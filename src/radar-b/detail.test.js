import { describe, expect, test } from 'vitest'
import { goUrlFor, areaLabel, provenanceSources, wlChips } from './EventDetail.jsx'

const src = (url) => ({ name: 'B365', url, kind: 'editorial' })

describe('goUrlFor', () => {
  test('tickets always win — that is what the screen is building towards', () => {
    expect(goUrlFor({ tickets: 'https://iabilet.ro/x', link: 'https://a.ro', sources: [] }))
      .toBe('https://iabilet.ro/x')
  })

  test('tickets are offered even when they are also a listed source', () => {
    expect(goUrlFor({ tickets: 'https://iabilet.ro/x', sources: [src('https://iabilet.ro/x')] }))
      .toBe('https://iabilet.ro/x')
  })

  test('an event link is offered when provenance does not already point there', () => {
    expect(goUrlFor({ link: 'https://venue.ro/event', sources: [src('https://b365.ro/weekend')] }))
      .toBe('https://venue.ro/event')
  })

  test('no button when the link is a source already listed above it', () => {
    // A Radar row's `Link` is often the article it was found in, so this is the
    // common case, not the edge one.
    expect(goUrlFor({ link: 'https://b365.ro/weekend', sources: [src('https://b365.ro/weekend')] }))
      .toBeNull()
  })

  test('no link, no button', () => {
    expect(goUrlFor({ sources: [] })).toBeNull()
    expect(goUrlFor({ link: null, sources: [src('https://b365.ro/x')] })).toBeNull()
  })

  test('survives a source with no url at all', () => {
    expect(goUrlFor({ link: 'https://venue.ro/e', sources: [src(null)] })).toBe('https://venue.ro/e')
  })
})

describe('areaLabel', () => {
  test('a real neighbourhood is shown', () => {
    expect(areaLabel('centru vechi')).toBe('centru vechi')
  })

  test('`altundeva` is dropped — it is Area\'s "none of the above"', () => {
    // Live rows use it for a park on the edge of town. Printed under the address
    // it reads as a place name and names nowhere.
    expect(areaLabel('altundeva')).toBeNull()
  })

  test('a missing area is missing, not an empty line', () => {
    expect(areaLabel(null)).toBeNull()
    expect(areaLabel('')).toBeNull()
  })
})

describe('provenanceSources', () => {
  const saved = { name: 'Wanderlist', url: 'https://notion.so/x', kind: 'saved' }
  const b365 = { name: 'B365', url: 'https://b365.ro/x', kind: 'editorial' }

  test('your own Wanderlist row is not a source that told you anything', () => {
    // It was rendered as `Wanderlist … WANDERLIST` — name and kind label the same
    // word — and linked to raw Notion.
    expect(provenanceSources({ sources: [b365, saved] })).toEqual([b365])
  })

  test('a Wanderlist-only event has no provenance section at all', () => {
    expect(provenanceSources({ sources: [saved] })).toEqual([])
  })

  test('recommendations and mentions both survive', () => {
    const rec = { name: 'Curatorial', kind: 'recommendation' }
    expect(provenanceSources({ sources: [rec, b365] })).toEqual([rec, b365])
  })

  test('an event with no sources at all does not throw', () => {
    expect(provenanceSources({})).toEqual([])
  })
})

describe('wlChips — a chip must say something the screen has not already said', () => {
  const ev = (p) => ({ start: '2026-08-26', end: null, hasTime: false, saved: true, ...p })

  test('a planned date equal to the event date is not repeated', () => {
    // The WHEN row already reads it. Planning something for the day it happens
    // is the normal case, so this was a duplicate on almost every saved event.
    expect(wlChips(ev({ plannedDate: '2026-08-26' })).plannedDate).toBeNull()
  })

  test('a planned date that genuinely differs is news and is kept', () => {
    // Catching a long run on one chosen day is the case worth showing.
    expect(wlChips(ev({ end: '2026-09-30', plannedDate: '2026-09-12' })).plannedDate).toBe('2026-09-12')
  })

  test('a planned TIME that differs from the event time still shows', () => {
    const e = ev({ start: '2026-08-26T21:00:00+03:00', hasTime: true, plannedDate: '2026-08-26', plannedTime: '18:30' })
    expect(wlChips(e).plannedDate).toBe('2026-08-26')
  })

  test('a matching planned time is not a difference', () => {
    const e = ev({ start: '2026-08-26T21:00:00+03:00', hasTime: true, plannedDate: '2026-08-26', plannedTime: '21:00' })
    expect(wlChips(e).plannedDate).toBeNull()
  })

  test('an expiry on the event\'s own last day is not a deadline worth stating', () => {
    expect(wlChips(ev({ dateExpiring: '2026-08-26' })).dateExpiring).toBeNull()
    expect(wlChips(ev({ end: '2026-08-30', dateExpiring: '2026-08-30' })).dateExpiring).toBeNull()
  })

  test('an expiry BEFORE the event is a real deadline', () => {
    // Booking closes before the thing happens — the one case worth a chip.
    expect(wlChips(ev({ end: '2026-09-30', dateExpiring: '2026-09-01' })).dateExpiring).toBe('2026-09-01')
  })

  test('an undated event keeps whatever Wanderlist dates it has', () => {
    const e = { start: null, saved: true, plannedDate: '2026-09-05', dateExpiring: '2026-09-09' }
    expect(wlChips(e).plannedDate).toBe('2026-09-05')
    expect(wlChips(e).dateExpiring).toBe('2026-09-09')
  })

  test('going and tickets are always facts in their own right', () => {
    expect(wlChips(ev({ going: true, hasTickets: true }))).toMatchObject({ going: true, hasTickets: true })
    expect(wlChips(ev({}))).toMatchObject({ going: false, hasTickets: false })
  })
})
