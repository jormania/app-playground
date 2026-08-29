import { describe, it, expect } from 'vitest'
import {
  toProductions, byDate, domIdForDay, nextDayKeys, densityForDays,
  categoryFor, categoriesInUse, visibleProductions, venueCategoryMap,
} from './programme.js'

// programme.js's other functions (byDate, visibleProductions, the filter
// helpers) are exercised through Programme.jsx/App.jsx's own tests. These
// three are new (the week strip) and pure enough to test directly.

const event = (over = {}) => ({
  key: over.key ?? 'k', venue: 'Excelsior', title: 'Tomcat', date: '2026-09-05',
  time: null, ticketState: 'none', hall: null, link: null, image: null, price: null, ...over,
})

describe('byDate', () => {
  it('orders a busy day by showtime, not by title', () => {
    const productions = toProductions([
      event({ key: 'a', title: 'Zebra', date: '2026-09-05', time: '20:00' }),
      event({ key: 'b', title: 'Apple', date: '2026-09-05', time: '11:00' }),
      event({ key: 'c', title: 'Mango', date: '2026-09-05', time: '15:00' }),
    ])
    const [day] = byDate(productions)
    expect(day.productions.map((p) => p.title)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('sorts a production by the showing that falls on THIS day, not a later one', () => {
    // "Zebra" opens today at 09:00 and returns tomorrow at 08:00 — the 08:00
    // must never leak into today's ordering (it's bucketed under today only
    // because that is its firstDate).
    const productions = toProductions([
      event({ key: 'a', title: 'Zebra', date: '2026-09-05', time: '09:00' }),
      event({ key: 'a2', title: 'Zebra', date: '2026-09-06', time: '08:00' }),
      event({ key: 'b', title: 'Mango', date: '2026-09-05', time: '10:00' }),
    ])
    const [day] = byDate(productions)
    expect(day.productions.map((p) => p.title)).toEqual(['Zebra', 'Mango'])
  })

  it('a time-less production sorts after every timed one, not alphabetically among them', () => {
    const productions = toProductions([
      event({ key: 'a', title: 'Apple', date: '2026-09-05', time: null }),
      event({ key: 'b', title: 'Zebra', date: '2026-09-05', time: '20:00' }),
    ])
    const [day] = byDate(productions)
    expect(day.productions.map((p) => p.title)).toEqual(['Zebra', 'Apple'])
  })

  it('ties — same showtime, or several time-less productions — fall back to title', () => {
    const productions = toProductions([
      event({ key: 'a', title: 'Zebra', date: '2026-09-05', time: '20:00' }),
      event({ key: 'b', title: 'Apple', date: '2026-09-05', time: '20:00' }),
      event({ key: 'c', title: 'Mango', date: '2026-09-05', time: null }),
      event({ key: 'd', title: 'Fig', date: '2026-09-05', time: null }),
    ])
    const [day] = byDate(productions)
    expect(day.productions.map((p) => p.title)).toEqual(['Apple', 'Zebra', 'Fig', 'Mango'])
  })
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

describe('categoryFor', () => {
  const vcMap = venueCategoryMap([{ name: 'Teatrul Excelsior', category: 'play' }, { name: 'ARCUB', category: 'event' }])

  it('falls back to the venue Category Default for a single-discipline venue', () => {
    const p = toProductions([event({ venue: 'Teatrul Excelsior', date: '2026-09-05' })])[0]
    expect(categoryFor(p, vcMap)).toBe('play')
  })

  it('prefers the production’s own category when its adapter could read one', () => {
    const p = toProductions([event({ venue: 'ARCUB', title: 'Cineva are să vină', date: '2026-09-05', category: 'play' })])[0]
    expect(categoryFor(p, vcMap)).toBe('play')
  })

  it('is null for a venue with no entry in the map at all', () => {
    const p = toProductions([event({ venue: 'Nobody Watches This', date: '2026-09-05' })])[0]
    expect(categoryFor(p, vcMap)).toBeNull()
  })
})

describe('visibleProductions — category filter honours a production’s own category', () => {
  const venues = [{ name: 'ARCUB', category: 'event' }]
  const venueCategory = venueCategoryMap(venues)
  const productions = toProductions([
    event({ key: 'a', venue: 'ARCUB', title: 'Cineva are să vină', date: '2026-09-05', category: 'play' }),
    event({ key: 'b', venue: 'ARCUB', title: 'Program artistic', date: '2026-09-06', category: null }),
  ])

  it('a production tagged by its own adapter matches that category, not the venue default', () => {
    const theatre = visibleProductions(productions, { category: 'play', venueCategory })
    expect(theatre.map((p) => p.title)).toEqual(['Cineva are să vină'])
  })

  it('a production with no category of its own still matches the venue default', () => {
    const events = visibleProductions(productions, { category: 'event', venueCategory })
    expect(events.map((p) => p.title)).toEqual(['Program artistic'])
  })

  it('the venue default alone would have hidden the theatre production from "Theatre" — the bug this fixes', () => {
    // Filtering by the venue's OWN category (the old behaviour) instead of
    // categoryFor would find nothing under "play", even though ARCUB is
    // running a play — exactly the gap an interdisciplinary venue exposed.
    const wrongWay = productions.filter((p) => venueCategory.get(p.venue) === 'play')
    expect(wrongWay).toHaveLength(0)
  })
})

describe('categoriesInUse', () => {
  it('always includes every active venue’s own default, productions or not', () => {
    const venues = [{ name: 'Teatrul Excelsior', category: 'play' }]
    expect(categoriesInUse(venues, [])).toEqual(['play'])
  })

  it('unions in a category only a production carries, beyond its venue’s default', () => {
    const venues = [{ name: 'ARCUB', category: 'event' }]
    const productions = toProductions([
      event({ venue: 'ARCUB', title: 'Cineva are să vină', date: '2026-09-05', category: 'play' }),
      event({ venue: 'ARCUB', title: 'Expoziție', date: '2026-09-06', category: 'art' }),
    ])
    // Order follows CATEGORY_ORDER, not discovery order.
    expect(categoriesInUse(venues, productions)).toEqual(['play', 'event', 'art'])
  })

  it('still works with no productions argument at all — every existing call site', () => {
    const venues = [{ name: 'Teatrul Excelsior', category: 'play' }, { name: 'Cinema Union', category: 'movie' }]
    expect(categoriesInUse(venues)).toEqual(['play', 'movie'])
  })
})
