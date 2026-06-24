import { test, expect, describe } from 'vitest'
import { filterEntries } from './search.js'

const entries = [
  { id: '1', title: 'the espresso foam', entry: 'it held its shape', tags: ['light', 'morning'], people: ['Mara'] },
  { id: '2', title: 'rain on the awning', entry: 'a tiny drum', tags: ['rain', 'sound'], people: [] },
  { id: '3', title: 'a stranger', entry: 'held the lift door', tags: ['kindness'], people: ['the courier'] },
]

describe('filterEntries', () => {
  test('empty query returns everything', () => {
    expect(filterEntries(entries, '', 'all')).toHaveLength(3)
    expect(filterEntries(entries, '   ', 'all')).toHaveLength(3)
  })
  test('text scope searches title and entry, not tags/people', () => {
    expect(filterEntries(entries, 'foam', 'text').map(e => e.id)).toEqual(['1'])
    expect(filterEntries(entries, 'Mara', 'text')).toHaveLength(0)
  })
  test('tags scope searches only tags', () => {
    expect(filterEntries(entries, 'rain', 'tags').map(e => e.id)).toEqual(['2'])
    expect(filterEntries(entries, 'awning', 'tags')).toHaveLength(0) // "awning" is in the title
  })
  test('people scope searches only people', () => {
    expect(filterEntries(entries, 'courier', 'people').map(e => e.id)).toEqual(['3'])
  })
  test('all scope spans every field', () => {
    expect(filterEntries(entries, 'Mara', 'all').map(e => e.id)).toEqual(['1'])
    expect(filterEntries(entries, 'kindness', 'all').map(e => e.id)).toEqual(['3'])
  })
  test('is case-insensitive', () => {
    expect(filterEntries(entries, 'ESPRESSO', 'all')).toHaveLength(1)
  })
  test('multiple tokens must all match (AND)', () => {
    expect(filterEntries(entries, 'held shape', 'all').map(e => e.id)).toEqual(['1'])
    expect(filterEntries(entries, 'held foam', 'text')).toHaveLength(1) // both in entry 1
  })
  test('a token must not span two separate fields', () => {
    // "morning Mara" — tag + person on the same entry, but no single token bridges them
    expect(filterEntries(entries, 'morningmara', 'all')).toHaveLength(0)
  })
})
