import { describe, test, expect } from 'vitest'
import { matchesQuery, matchesFilters, emptyFilters, buildStream, facets, toBrief, isNewToYou } from './search.js'
import { normalizeEvent } from './model.js'

const ev = (over) => normalizeEvent({ name: 'x', ...over })
const WED = new Date(2026, 7, 19, 15, 0)

describe('matchesQuery', () => {
  const e = ev({
    name: 'Trio Nocturn', venue: 'Control Club', area: 'centru',
    summary: 'Jazz de improvizație liberă.',
    sources: [{ name: 'Curatorial' }],
  })

  test('ignores diacritics both ways', () => {
    expect(matchesQuery(e, 'improvizatie')).toBe(true)
    expect(matchesQuery(ev({ name: 'Piata Unirii' }), 'Piața')).toBe(true)
  })

  test('every term must match — not any', () => {
    expect(matchesQuery(e, 'jazz control')).toBe(true)
    expect(matchesQuery(e, 'jazz cinema')).toBe(false)
  })

  test('searches source names, which only this app can answer', () => {
    expect(matchesQuery(e, 'curatorial')).toBe(true)
  })

  test('an empty query matches everything', () => {
    expect(matchesQuery(e, '')).toBe(true)
  })
})

describe('matchesFilters', () => {
  const e = ev({ name: 'x', category: 'art', area: 'centru', signals: ['free'], cost: null })

  test('filters combine as AND across facets', () => {
    expect(matchesFilters(e, { ...emptyFilters(), categories: ['art'], areas: ['centru'] })).toBe(true)
    expect(matchesFilters(e, { ...emptyFilters(), categories: ['art'], areas: ['cotroceni'] })).toBe(false)
  })

  test('multiple signals must ALL be present', () => {
    expect(matchesFilters(e, { ...emptyFilters(), signals: ['free'] })).toBe(true)
    expect(matchesFilters(e, { ...emptyFilters(), signals: ['free', 'family'] })).toBe(false)
  })

  test('a free event always passes a price ceiling', () => {
    expect(matchesFilters(e, { ...emptyFilters(), maxCost: 0 })).toBe(true)
  })

  test('an unpriced event is excluded by a price ceiling rather than assumed cheap', () => {
    const unpriced = ev({ name: 'y', cost: null })
    expect(matchesFilters(unpriced, { ...emptyFilters(), maxCost: 50 })).toBe(false)
  })
})

describe('buildStream', () => {
  const pool = [
    ev({ id: 'tonight', name: 'Trio Nocturn', start: '2026-08-19T21:00:00', hasTime: true }),
    ev({ id: 'tomorrow', name: 'Festival', start: '2026-08-20' }),
    ev({ id: 'run', name: 'Lumină difuză', start: '2026-07-01', end: '2026-11-01' }),
    ev({ id: 'past', name: 'Gone', start: '2026-08-01' }),
  ]

  test('past events never appear, in any lens', () => {
    const out = buildStream(pool, { view: 'week', filters: emptyFilters(), now: WED })
    const ids = out.days.flatMap((d) => d.events.map((e) => e.id))
    expect(ids).not.toContain('past')
  })

  test('a long run is lifted out of the day groups into its own section', () => {
    const out = buildStream(pool, { view: 'week', filters: emptyFilters(), now: WED })
    expect(out.standing.map((e) => e.id)).toEqual(['run'])
    expect(out.days.flatMap((d) => d.events.map((e) => e.id))).toEqual(['tonight', 'tomorrow'])
  })

  test('days come back in chronological order', () => {
    const out = buildStream(pool, { view: 'week', filters: emptyFilters(), now: WED })
    expect(out.days.map((d) => d.key)).toEqual(['2026-08-19', '2026-08-20'])
  })

  test('the running lens shows exactly the long runs', () => {
    const out = buildStream(pool, { view: 'running', filters: emptyFilters(), now: WED })
    expect(out.days.flatMap((d) => d.events.map((e) => e.id))).toEqual(['run'])
  })

  test('dismissed events disappear', () => {
    const out = buildStream(pool, { view: 'week', filters: emptyFilters(), now: WED, dismissed: new Set(['tonight']) })
    expect(out.total).toBe(2)
  })

  test('a festival that started yesterday is grouped under today, not its opening night', () => {
    const started = [ev({ id: 'f', name: 'Festival', start: '2026-08-18', end: '2026-08-20' })]
    const out = buildStream(started, { view: 'week', filters: emptyFilters(), now: WED })
    expect(out.days[0].key).toBe('2026-08-19')
  })
})

describe('isNewToYou', () => {
  test('an event you have already opened is not new', () => {
    const e = ev({ id: 'a', start: '2026-08-20' })
    expect(isNewToYou(e, new Set(['a']), {}, WED)).toBe(false)
    expect(isNewToYou(e, new Set(), {}, WED)).toBe(true)
  })

  test('something that has sat unopened for weeks stops counting as new', () => {
    const e = ev({ id: 'a', start: '2026-08-20' })
    const old = { a: Date.now() - 30 * 86400000 }
    expect(isNewToYou(e, new Set(), old, WED)).toBe(false)
  })
})

describe('facets', () => {
  test('counts only live events, commonest first', () => {
    const out = facets([
      ev({ name: 'a', category: 'art', start: '2026-08-20' }),
      ev({ name: 'b', category: 'art', start: '2026-08-21' }),
      ev({ name: 'c', category: 'concert', start: '2026-08-21' }),
      ev({ name: 'd', category: 'movie', start: '2026-08-01' }), // past — not offered
    ], WED)
    expect(out.categories).toEqual([['art', 2], ['concert', 1]])
  })
})

describe('toBrief', () => {
  test('produces a numbered, paste-ready list for Recommend in Bucharest', () => {
    const stream = buildStream(
      [ev({ id: 'a', name: 'Trio Nocturn', venue: 'Control', area: 'centru', start: '2026-08-19T21:00:00', hasTime: true, link: 'https://x.example' })],
      { view: 'tonight', filters: emptyFilters(), now: WED },
    )
    const brief = toBrief(stream, 'tonight')
    expect(brief).toContain('1. Trio Nocturn — Control, centru (https://x.example)')
    expect(brief).toContain('Care dintre ele mi s-ar potrivi?')
  })
})
