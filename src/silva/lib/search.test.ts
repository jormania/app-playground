import { describe, it, expect } from 'vitest'
import { lexicalMatch, combineResults } from './search'
import type { Thing } from './notion'

function thing(overrides: Partial<Thing>): Thing {
  return {
    id: 'thing-1',
    handle: 'A passage',
    body: 'A passage worth keeping.',
    kind: 'Passage',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-01-01',
    kept: '2026-01-01',
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    ...overrides,
  }
}

describe('lexicalMatch', () => {
  it('matches on body, case-insensitively', () => {
    expect(lexicalMatch('WORTH', thing({ body: 'A passage worth keeping.' }))).toBe(true)
  })

  it('matches on note', () => {
    expect(lexicalMatch('reason', thing({ body: 'x', note: 'A good reason.' }))).toBe(true)
  })

  it('is false for no overlap', () => {
    expect(lexicalMatch('zzz', thing({ body: 'A passage worth keeping.' }))).toBe(false)
  })

  it('is false for an empty query', () => {
    expect(lexicalMatch('', thing({ body: 'A passage worth keeping.' }))).toBe(false)
  })
})

describe('combineResults', () => {
  const things = [
    thing({ id: 't1', body: 'We are what we repeatedly do.' }),
    thing({ id: 't2', body: 'A dog waited at the tram stop.' }),
    thing({ id: 't3', body: 'Habit shapes character over time.' }),
  ]

  it('returns nothing for an empty query', () => {
    expect(combineResults('', things, null, new Map())).toEqual([])
  })

  it('returns lexical matches immediately when no query vector is available yet', () => {
    const results = combineResults('repeatedly', things, null, new Map())
    expect(results).toHaveLength(1)
    expect(results[0].thing.id).toBe('t1')
    expect(results[0].matchType).toBe('lexical')
  })

  it('adds semantic matches above the threshold, ranked by similarity', () => {
    const queryVector = new Float32Array([1, 0])
    const vectors = new Map([
      ['t1', new Float32Array([0.9, 0.1])], // close — should surface
      ['t2', new Float32Array([0, 1])], // orthogonal — below threshold
      ['t3', new Float32Array([0.5, 0.5])], // borderline-ish, above threshold
    ])
    const results = combineResults('nothing lexical here', things, queryVector, vectors)
    const ids = results.map((r) => r.thing.id)
    expect(ids).toContain('t1')
    expect(ids).not.toContain('t2')
    // t1 (higher similarity) ranks above t3
    expect(ids.indexOf('t1')).toBeLessThan(ids.indexOf('t3'))
  })

  it('marks a thing matching both ways as "both", not a duplicate', () => {
    const queryVector = new Float32Array([1, 0])
    const vectors = new Map([['t1', new Float32Array([1, 0])]])
    const results = combineResults('repeatedly', things, queryVector, vectors)
    const t1Results = results.filter((r) => r.thing.id === 't1')
    expect(t1Results).toHaveLength(1)
    expect(t1Results[0].matchType).toBe('both')
  })

  it('never surfaces a thing with no vector and no lexical hit', () => {
    const queryVector = new Float32Array([1, 0])
    const results = combineResults('nothing lexical here', things, queryVector, new Map())
    expect(results).toEqual([])
  })
})
