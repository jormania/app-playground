import { describe, test, expect } from 'vitest'
import { toDraft, toFindingsPage, expiryFor, placeFor, mapUrlFor } from './wanderlist.js'
import { normalizeEvent } from './model.js'

const ev = (over) => normalizeEvent({ name: 'Trio Nocturn', ...over })
const NOW = new Date(2026, 7, 19, 15, 0)

describe('placeFor', () => {
  test('venue plus street plus city — a bare name does not geocode', () => {
    expect(placeFor(ev({ venue: 'Control Club', address: 'Str. Mille 4' })))
      .toBe('Control Club, Str. Mille 4, București')
  })

  test('does not append București twice', () => {
    expect(placeFor(ev({ venue: 'Control Club, Str. Mille 4, București' })))
      .toBe('Control Club, Str. Mille 4, București')
  })

  test('at minimum appends the city to a bare venue name', () => {
    expect(placeFor(ev({ venue: 'ARCUB' }))).toBe('ARCUB, București')
  })

  test('no place at all stays null rather than inventing one', () => {
    expect(placeFor(ev({}))).toBeNull()
    expect(mapUrlFor(ev({}))).toBeNull()
  })
})

describe('expiryFor', () => {
  test('a one-off event expires on its own date — missing it means missing it', () => {
    expect(expiryFor(ev({ start: '2026-08-21' }))).toBe('2026-08-21')
  })

  test('a run expires on its closing date', () => {
    expect(expiryFor(ev({ start: '2026-08-01', end: '2026-11-01' }))).toBe('2026-11-01')
  })

  test('a recurring event gets no invented deadline', () => {
    expect(expiryFor(ev({ start: '2026-08-21', signals: ['recurring'] }))).toBeNull()
  })

  test('an undated event gets no deadline either', () => {
    expect(expiryFor(ev({ start: null }))).toBeNull()
  })
})

describe('toDraft', () => {
  const event = ev({
    start: '2026-08-21T21:00:00+03:00', hasTime: true,
    venue: 'Control Club', address: 'Str. Mille 4', category: 'concert',
    summary: 'Jazz de improvizație.', cost: 60, signals: ['ticketed', 'recommended'],
    link: 'https://venue.example/x', tickets: 'https://iabilet.ro/y',
    sources: [{ name: 'Curatorial', url: 'https://curatorial.ro/z' }],
  })

  test('a new row is never going and never attended, even with a known date', () => {
    const d = toDraft(event, NOW)
    expect(d.going).toBe(false)
    expect(d.attended).toBe(false)
    expect(d.plannedDate).toBe('2026-08-21')
  })

  test('prefers the ticket link, then the event page, then the article', () => {
    expect(toDraft(event, NOW).link).toBe('https://iabilet.ro/y')
    expect(toDraft(ev({ ...event, tickets: null }), NOW).link).toBe('https://venue.example/x')
    expect(toDraft(ev({ ...event, tickets: null, link: null }), NOW).link).toBe('https://curatorial.ro/z')
  })

  test('keeps only signals that map onto Wanderlist\'s own tag vocabulary', () => {
    // `recommended` is a Radar-B concept and must not leak into Findings' tags.
    expect(toDraft(event, NOW).tags).toEqual(['ticketed'])
  })

  test('falls back to a closed-vocabulary category rather than inventing one', () => {
    expect(toDraft(ev({ category: 'nonsense' }), NOW).category).toBe('event')
  })

  test('a free event carries no cost', () => {
    expect(toDraft(ev({ signals: ['free'], cost: 60 }), NOW).cost).toBeNull()
  })

  test('description is never blank — a thin source says it is thin', () => {
    const d = toDraft(ev({ summary: null, venue: 'Control Club', sources: [{ name: 'HotNews' }] }), NOW)
    expect(d.description).toContain('Control Club')
    expect(d.description).toContain('HotNews')
    expect(d.description).toContain('de verificat')
  })

  test('stamps Date Added with today', () => {
    expect(toDraft(event, NOW).dateAdded).toBe('2026-08-19')
  })
})

describe('the mainstream signal never leaks into Wanderlist tags', () => {
  test('a "De știut" event carries no matching Findings tag', () => {
    const d = toDraft(ev({ signals: ['mainstream'] }), NOW)
    expect(d.tags).toEqual([])
  })
})

describe('toFindingsPage', () => {
  test('writes the Findings schema through the SHARED mapping, not a local copy', () => {
    const draft = toDraft(ev({ start: '2026-08-21T21:00:00+03:00', hasTime: true, venue: 'Control Club', category: 'concert', summary: 'Jazz.' }), NOW)
    const page = toFindingsPage(draft, 'db-1')
    expect(page.parent).toEqual({ database_id: 'db-1' })
    expect(page.properties.Name.title[0].text.content).toBe('Trio Nocturn')
    // Real Notion checkboxes, per WANDERLIST.md's schema.
    expect(page.properties.Attended).toEqual({ checkbox: false })
    expect(page.properties.Going).toEqual({ checkbox: false })
    expect(page.properties.Category).toEqual({ select: { name: 'concert' } })
    // A planned time is written as a full ISO datetime with an offset.
    expect(page.properties['Planned Date'].date.start).toMatch(/^2026-08-21T21:00:00[+-]\d{2}:\d{2}$/)
  })

  test('a bare planned date stays bare — no time is invented', () => {
    const draft = toDraft(ev({ start: '2026-08-21', hasTime: false }), NOW)
    expect(toFindingsPage(draft, 'db-1').properties['Planned Date'].date.start).toBe('2026-08-21')
  })
})
