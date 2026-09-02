import { describe, it, expect } from 'vitest'
import { lexicalMatch, combineResults, filterByKind, filterBySource, queryTerms } from './search'
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
    arrived: null,
    ...overrides,
  }
}

describe('lexicalMatch', () => {
  it('matches on body, case-insensitively', () => {
    expect(lexicalMatch('WORTH', thing({ body: 'A passage worth keeping.' }))).toBe(true)
  })

  // A kept link loses its URL from the body the moment the article's title
  // lands there, and the domain is the one part of it anyone recalls.
  it('matches on the link a thing points at', () => {
    const kept = thing({ body: 'The joy of missing out', link: 'https://nesslabs.com/jomo' })
    expect(lexicalMatch('nesslabs', kept)).toBe(true)
    expect(lexicalMatch('jomo', kept)).toBe(true)
    expect(lexicalMatch('nesslabs', thing({ body: 'x', link: null }))).toBe(false)
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

  // "I remember something Shelby Foote said" should find a passage even
  // when the word "Shelby" never appears in the body itself.
  it('matches on a source title or author when supplied', () => {
    const t = thing({ body: 'A quotation with no matching words at all.' })
    expect(lexicalMatch('civil war', t, 'The Civil War: A Narrative', '')).toBe(true)
    expect(lexicalMatch('foote', t, 'The Civil War', 'Shelby Foote')).toBe(true)
    expect(lexicalMatch('nothing here', t, 'The Civil War', 'Shelby Foote')).toBe(false)
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

  it('finds a thing by its source, via the sourceById map', () => {
    const sourced = [thing({ id: 't4', body: 'No matching words in the body.', sourceId: 'src-1' })]
    const sourceById = new Map([['src-1', { title: 'The Civil War', author: 'Shelby Foote' }]])
    const results = combineResults('foote', sourced, null, new Map(), sourceById)
    expect(results.map((r) => r.thing.id)).toEqual(['t4'])
  })
})

describe('filterBySource', () => {
  const withSources = [
    thing({ id: 'a', sourceId: 'src-1' }),
    thing({ id: 'b', sourceId: 'src-2' }),
    thing({ id: 'c', sourceId: null }),
  ]

  it('returns everything unchanged when sourceId is null', () => {
    expect(filterBySource(withSources, null)).toEqual(withSources)
  })

  it('narrows to only things from the given source', () => {
    expect(filterBySource(withSources, 'src-1').map((t) => t.id)).toEqual(['a'])
  })

  it('returns an empty array for a source nothing has', () => {
    expect(filterBySource(withSources, 'src-9')).toEqual([])
  })
})

describe('filterByKind', () => {
  const withKinds = [
    thing({ id: 'q1', kind: 'Question' }),
    thing({ id: 'p1', kind: 'Passage' }),
    thing({ id: 'p2', kind: 'Passage' }),
    thing({ id: 'n1', kind: null }),
  ]

  it('returns everything unchanged when kind is null', () => {
    expect(filterByKind(withKinds, null)).toEqual(withKinds)
  })

  it('narrows to only things with the given kind', () => {
    expect(filterByKind(withKinds, 'Passage').map((t) => t.id)).toEqual(['p1', 'p2'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterByKind(withKinds, 'Dialogue')).toEqual([])
  })
})

describe('queryTerms', () => {
  it('splits on whitespace', () => {
    expect(queryTerms('dog tram')).toEqual(['dog', 'tram'])
  })

  it('keeps a quoted phrase intact', () => {
    expect(queryTerms('"a dog sat" stop')).toEqual(['a dog sat', 'stop'])
  })

  it('is empty for nothing but whitespace', () => {
    expect(queryTerms('   ')).toEqual([])
    expect(queryTerms('')).toEqual([])
  })

  it('lowercases so matching never has to care about case', () => {
    expect(queryTerms('Marcus AURELIUS')).toEqual(['marcus', 'aurelius'])
  })
})

describe('lexicalMatch — search patterns', () => {
  const dog = thing({
    id: 'dog',
    body: 'A dog sat at the tram stop for twenty minutes, waiting for someone who never came.',
    note: 'Still think about this one.',
    locator: 'overheard on the 32 tram',
  })

  // The ordinary way anyone searches something half-remembered: two words
  // from different parts of it. As one contiguous substring this failed.
  it('matches several remembered words from anywhere in the thing', () => {
    expect(lexicalMatch('dog stop', dog)).toBe(true)
    expect(lexicalMatch('waiting dog', dog)).toBe(true)
  })

  it('requires every term, not just one of them', () => {
    expect(lexicalMatch('dog bicycle', dog)).toBe(false)
  })

  it('honours quotes as an exact phrase', () => {
    expect(lexicalMatch('"dog sat"', dog)).toBe(true)
    expect(lexicalMatch('"sat dog"', dog)).toBe(false)
  })

  // The locator holds your own words about where you were, and was the one
  // field a thing carries that searching could not reach.
  it('searches the locator', () => {
    expect(lexicalMatch('32 tram', dog)).toBe(true)
    expect(lexicalMatch('overheard', dog)).toBe(true)
  })

  it('still searches the note and the source', () => {
    expect(lexicalMatch('still think', dog)).toBe(true)
    expect(lexicalMatch('foote', thing({ id: 'a' }), 'The Civil War', 'Shelby Foote')).toBe(true)
  })

  it('matches across fields — a word from the body and one from the source', () => {
    expect(lexicalMatch('dog overheard', dog)).toBe(true)
  })

  // Joined with a separator so two fields can't accidentally form a term
  // that neither of them contains.
  it('does not match a phrase straddling the join between two fields', () => {
    expect(lexicalMatch('"came Still"', dog)).toBe(false)
  })

  it('is false for an empty query', () => {
    expect(lexicalMatch('   ', dog)).toBe(false)
  })
})
