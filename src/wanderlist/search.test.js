import { test, expect, describe } from 'vitest'
import { filterBySearch, filterByStatus, sortEntries, triage, isIdea } from './search.js'

const items = [
  { id: 'a', name: 'Jazz in the garden', description: 'free sunday sessions', category: 'Event', place: 'Grădina Uranus', tags: ['free', 'outdoor'], attended: false, dateAdded: '2026-06-30', dateExpiring: null },
  { id: 'b', name: 'Brâncuși retrospective', description: 'timed entry', category: 'Art', place: 'MNAR', tags: ['ticketed'], attended: false, dateAdded: '2026-06-24', dateExpiring: '2026-07-14' },
  { id: 'c', name: 'Art Deco walk', description: 'interwar façades', category: 'Culture', place: 'Magheru', tags: ['ticketed', 'outdoor'], attended: false, dateAdded: '2026-07-05', dateExpiring: '2026-07-09' },
  { id: 'd', name: 'Enescu — Beethoven', description: 'went with M', category: 'Culture', place: 'Ateneu', tags: ['music'], attended: true, dateAdded: '2026-05-20', dateExpiring: '2026-05-28' },
]

describe('filterBySearch', () => {
  test('matches text scope across name + description', () => {
    expect(filterBySearch(items, 'façades', 'text').map(e => e.id)).toEqual(['c'])
  })
  test('scopes to category / place / tags', () => {
    expect(filterBySearch(items, 'culture', 'category').map(e => e.id)).toEqual(['c', 'd'])
    expect(filterBySearch(items, 'uranus', 'place').map(e => e.id)).toEqual(['a'])
    expect(filterBySearch(items, 'outdoor', 'tags').map(e => e.id)).toEqual(['a', 'c'])
  })
  test('all tokens must match (AND); empty query returns all', () => {
    expect(filterBySearch(items, 'walk deco', 'all').map(e => e.id)).toEqual(['c'])
    expect(filterBySearch(items, '', 'all')).toHaveLength(4)
  })
})

describe('filterByStatus', () => {
  test('todo excludes attended; attended only attended; all keeps everything', () => {
    expect(filterByStatus(items, 'todo').map(e => e.id)).toEqual(['a', 'b', 'c'])
    expect(filterByStatus(items, 'attended').map(e => e.id)).toEqual(['d'])
    expect(filterByStatus(items, 'all')).toHaveLength(4)
  })
  test('ideas: unattended with no planned date and no expiry (a has neither)', () => {
    // a has no dateExpiring and no plannedDate -> an idea; the rest have a date or are attended.
    expect(filterByStatus(items, 'ideas').map(e => e.id)).toEqual(['a'])
  })
  test('ideas excludes anything with a planned date, an expiry, or attended', () => {
    const set = [
      { id: 'bare', attended: false, plannedDate: null, dateExpiring: null },
      { id: 'planned', attended: false, plannedDate: '2026-07-20', dateExpiring: null },
      { id: 'expiring', attended: false, plannedDate: null, dateExpiring: '2026-07-20' },
      { id: 'done', attended: true, plannedDate: null, dateExpiring: null },
    ]
    expect(filterByStatus(set, 'ideas').map(e => e.id)).toEqual(['bare'])
  })
})

describe('isIdea', () => {
  test('true only for an unattended, dateless item', () => {
    expect(isIdea({ attended: false, plannedDate: null, dateExpiring: null })).toBe(true)
    expect(isIdea({ attended: true, plannedDate: null, dateExpiring: null })).toBe(false)
    expect(isIdea({ attended: false, plannedDate: '2026-07-20', dateExpiring: null })).toBe(false)
    expect(isIdea({ attended: false, plannedDate: null, dateExpiring: '2026-07-20' })).toBe(false)
    expect(isIdea(null)).toBe(false)
  })
})

describe('sortEntries', () => {
  const today = '2026-07-08'
  test('expiring first: soonest deadline up, no-deadline items after', () => {
    // c (07-09) before b (07-14); a (none) last. d filtered out separately.
    const active = items.filter(e => !e.attended)
    expect(sortEntries(active, 'expiring', today).map(e => e.id)).toEqual(['c', 'b', 'a'])
  })
  test('recently added and A–Z', () => {
    expect(sortEntries(items, 'added').map(e => e.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(sortEntries(items, 'az').map(e => e.id)[0]).toBe('c') // "Art Deco walk"
  })
  test('expiring first: past-due unattended items sink below no-deadline items, most-recently-expired first', () => {
    const withPast = [
      { id: 'future', name: 'Future', attended: false, dateAdded: '2026-06-01', dateExpiring: '2026-07-20' },
      { id: 'none', name: 'No deadline', attended: false, dateAdded: '2026-06-01', dateExpiring: null },
      { id: 'old', name: 'Long expired', attended: false, dateAdded: '2026-06-01', dateExpiring: '2026-06-01' },
      { id: 'recent', name: 'Recently expired', attended: false, dateAdded: '2026-06-01', dateExpiring: '2026-07-05' },
      { id: 'attended-past', name: 'Attended, was past', attended: true, dateAdded: '2026-06-01', dateExpiring: '2026-05-01' },
    ]
    // future first (soonest deadline), then no-deadline, then past-due newest-expired-first;
    // an attended item never sinks into the past tier even with an old deadline.
    expect(sortEntries(withPast, 'expiring', today).map(e => e.id))
      .toEqual(['future', 'attended-past', 'none', 'recent', 'old'])
  })
})

describe('sortEntries — planned (Going, then Planned)', () => {
  const today = '2026-07-08'
  const set = [
    { id: 'going-far', name: 'Going far out', attended: false, going: true, dateAdded: '2026-06-01', plannedDate: '2026-08-01' },
    { id: 'going-near', name: 'Going soon', attended: false, going: true, dateAdded: '2026-06-01', plannedDate: '2026-07-10' },
    { id: 'undecided-near', name: 'Undecided, soon', attended: false, going: false, dateAdded: '2026-06-01', plannedDate: '2026-07-09' },
    { id: 'undecided-far', name: 'Undecided, far', attended: false, going: false, dateAdded: '2026-06-01', plannedDate: '2026-09-01' },
    { id: 'none', name: 'No planned date', attended: false, going: false, dateAdded: '2026-06-01', plannedDate: null },
    { id: 'past', name: 'Planned date passed', attended: false, going: false, dateAdded: '2026-06-01', plannedDate: '2026-07-01' },
    { id: 'attended', name: 'Attended, was planned', attended: true, going: true, dateAdded: '2026-06-01', plannedDate: '2026-07-20' },
  ]
  test('every Going entry ranks before every undecided Planned entry, each soonest-first; undated/attended sit in the middle; past-planned sinks to the bottom', () => {
    expect(sortEntries(set, 'planned', today).map(e => e.id))
      .toEqual(['going-near', 'going-far', 'undecided-near', 'undecided-far', 'attended', 'none', 'past'])
  })
})

describe('triage pipeline', () => {
  test('status → search → sort in one call', () => {
    const out = triage(items, { status: 'todo', query: 'outdoor', scope: 'tags', sort: 'expiring', today: '2026-07-08' })
    expect(out.map(e => e.id)).toEqual(['c', 'a']) // c has a deadline, a doesn't
  })
})
