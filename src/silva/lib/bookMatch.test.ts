import { describe, it, expect } from 'vitest'
import { normalizeTitle, titleSimilarity, matchSource } from './bookMatch'
import type { Source } from './sources'

function source(overrides: Partial<Source>): Source {
  return {
    id: 'source-1',
    title: 'Meditations',
    author: '',
    kind: 'Book',
    cover: null,
    koboVolumeId: null,
    notes: '',
    ...overrides,
  }
}

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation and diacritics, collapses whitespace', () => {
    expect(normalizeTitle('  Café,  in  Vienna!  ')).toBe('cafe in vienna')
  })

  it('strips parenthetical and bracketed edition noise', () => {
    expect(normalizeTitle('Meditations (Penguin Classics)')).toBe('meditations')
    expect(normalizeTitle('Meditations [Unabridged]')).toBe('meditations')
  })
})

describe('titleSimilarity', () => {
  it('is 1 for an exact match after normalization', () => {
    expect(titleSimilarity('Meditations', 'meditations!')).toBe(1)
  })

  it('is 0.9 for substring containment — a subtitle difference', () => {
    expect(titleSimilarity('Meditations', 'Meditations: A New Translation')).toBe(0.9)
  })

  it('is 0 for unrelated titles', () => {
    expect(titleSimilarity('Meditations', 'The Odyssey')).toBe(0)
  })

  it('is 0 when either side is empty', () => {
    expect(titleSimilarity('', 'Meditations')).toBe(0)
    expect(titleSimilarity('Meditations', '')).toBe(0)
  })
})

describe('matchSource', () => {
  it('an exact koboVolumeId match wins regardless of title drift', () => {
    const sources = [source({ id: 's1', title: 'Completely Different Title', koboVolumeId: 'vol-1' })]
    const match = matchSource('Meditations (2026 reissue)', 'vol-1', sources)
    expect(match).toEqual({ source: sources[0], confidence: 'exact', similarity: 1 })
  })

  it('falls back to fuzzy title matching when no koboVolumeId matches', () => {
    const sources = [source({ id: 's1', title: 'Meditations', koboVolumeId: 'vol-other' })]
    const match = matchSource('Meditations (Penguin Classics)', 'vol-new', sources)
    expect(match?.source.id).toBe('s1')
    expect(match?.confidence).toBe('high')
  })

  it('returns null when nothing clears the similarity threshold — propose create-new', () => {
    const sources = [source({ id: 's1', title: 'The Odyssey' })]
    expect(matchSource('Meditations', null, sources)).toBeNull()
  })

  it('returns null against an empty Sources list', () => {
    expect(matchSource('Meditations', null, [])).toBeNull()
  })

  it('picks the best of several candidates, not just the first', () => {
    const sources = [
      source({ id: 's1', title: 'The Odyssey' }),
      source({ id: 's2', title: 'Meditations: A New Translation' }),
    ]
    const match = matchSource('Meditations', null, sources)
    expect(match?.source.id).toBe('s2')
  })
})
