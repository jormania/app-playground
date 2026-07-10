import { test, expect, describe } from 'vitest'
import { computeStats } from './stats.js'

const today = '2026-07-08'

const entries = [
  { id: 'a', name: 'Anim’est', attended: false, category: 'Event', place: 'Cinema Pro', tags: ['ticketed', 'film'], dateExpiring: '2026-07-10', plannedDate: '2026-07-11', tickets: [{ url: 'x' }] },
  { id: 'b', name: 'Brâncuși', attended: false, category: 'Art', place: 'MNAR', tags: ['ticketed', 'culture'], dateExpiring: '2026-07-14', plannedDate: null },
  { id: 'c', name: 'Art Deco walk', attended: false, category: 'Culture', place: 'Magheru', tags: ['outdoor'], dateExpiring: '2026-07-01', plannedDate: null }, // past due, still open
  { id: 'd', name: 'Ramen place', attended: false, category: 'Idea', place: 'Dorobanți', tags: [], dateExpiring: null, plannedDate: null }, // no deadline
  { id: 'e', name: 'Jazz garden', attended: false, category: 'Event', place: 'Uranus', tags: ['free'], dateExpiring: null, plannedDate: '2026-07-09' }, // planned soon
  { id: 'f', name: 'Enescu (gone)', attended: true, category: 'Culture', place: 'Ateneu', tags: ['music'], dateExpiring: '2026-05-28', plannedDate: null }, // attended — ignored everywhere
]

describe('computeStats', () => {
  const s = computeStats(entries, today)

  test('total counts only unattended items', () => expect(s.total).toBe(5))
  test('expiring within 7 days', () => expect(s.expiringSoon).toBe(2)) // a: 07-10 (2 days out), b: 07-14 (6 days out)
  test('past due, still unattended, sinks into needsAttention not expiringSoon', () => expect(s.needsAttention).toBe(1)) // c
  test('planned within 7 days', () => expect(s.plannedSoon).toBe(2)) // a: 07-11, e: 07-09
  test('no deadline at all', () => expect(s.noDeadline).toBe(2)) // d, e
  test('with tickets on file', () => expect(s.withTickets).toBe(1)) // a
  test('next up: soonest future deadline, attended items excluded', () => {
    expect(s.nextUp).toEqual({ name: 'Anim’est', days: 2 })
  })
  test('top categories, most frequent first, attended excluded', () => {
    expect(s.topCategories).toEqual([
      { name: 'Event', count: 2 },
      { name: 'Art', count: 1 },
      { name: 'Culture', count: 1 },
      { name: 'Idea', count: 1 },
    ])
  })
  test('top tags, ranks ALL, never capped', () => {
    expect(s.topTags).toEqual([
      { name: 'ticketed', count: 2 },
      { name: 'culture', count: 1 },
      { name: 'film', count: 1 },
      { name: 'free', count: 1 },
      { name: 'outdoor', count: 1 },
    ])
  })
  test('top places — all five, one each (tie order not asserted)', () => {
    expect(s.topPlaces).toHaveLength(5)
    expect(s.topPlaces.every(p => p.count === 1)).toBe(true)
    expect(s.topPlaces.map(p => p.name).sort()).toEqual(['Cinema Pro', 'Dorobanți', 'MNAR', 'Magheru', 'Uranus'].sort())
  })
  test('empty backlog is all zeroes, no crash', () => {
    const z = computeStats([], today)
    expect(z).toMatchObject({ total: 0, expiringSoon: 0, needsAttention: 0, plannedSoon: 0, noDeadline: 0, withTickets: 0, nextUp: null })
  })
  test('all-attended backlog counts as empty', () => {
    const z = computeStats([entries[5]], today)
    expect(z.total).toBe(0)
  })
})
