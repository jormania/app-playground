import { describe, it, expect } from 'vitest'
import { parseSourceInput, resolveSource, sourceInputValue, CAPTURE_MATCH_THRESHOLD } from './sourceCapture'
import type { Source } from './sources'

function source(over: Partial<Source> = {}): Source {
  return {
    id: 's1',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    kind: 'Book',
    cover: null,
    koboVolumeId: null,
    notes: '',
    ...over,
  }
}

describe('parseSourceInput', () => {
  it('is empty for an empty or whitespace-only string', () => {
    expect(parseSourceInput('')).toEqual({ title: '', author: '' })
    expect(parseSourceInput('   ')).toEqual({ title: '', author: '' })
  })

  it('splits on " by ", the one unambiguous separator', () => {
    expect(parseSourceInput('The Death of Ivan Ilyich by Tolstoy')).toEqual({
      title: 'The Death of Ivan Ilyich',
      author: 'Tolstoy',
    })
  })

  it('splits on the LAST " by " so a title that itself contains "by" still parses', () => {
    expect(parseSourceInput('Notes by a Window by Someone Else')).toEqual({
      title: 'Notes by a Window',
      author: 'Someone Else',
    })
  })

  // "Shelby Foote — The Civil War" and "The Civil War — Shelby Foote" are the
  // same shape read two ways; guessing which half is the title is exactly
  // the kind of confident inference SILVA.md forbids the app from making.
  it('does not guess at author-first text with no "by" — the whole thing is the title', () => {
    expect(parseSourceInput('Shelby Foote — The Civil War: A Narrative')).toEqual({
      title: 'Shelby Foote — The Civil War: A Narrative',
      author: '',
    })
  })

  it('collapses internal whitespace and trims', () => {
    expect(parseSourceInput('  Meditations   by   Marcus Aurelius  ')).toEqual({
      title: 'Meditations',
      author: 'Marcus Aurelius',
    })
  })
})

describe('resolveSource', () => {
  const existing = [source({ id: 's1', title: 'Meditations', author: 'Marcus Aurelius' })]

  it('resolves to nothing for empty input', () => {
    expect(resolveSource('', existing)).toEqual({ kind: 'none' })
    expect(resolveSource('   ', existing)).toEqual({ kind: 'none' })
  })

  it('reuses an exact title match rather than creating a duplicate', () => {
    expect(resolveSource('Meditations', existing)).toEqual({ kind: 'existing', source: existing[0] })
  })

  it('reuses a title that differs only by edition noise', () => {
    const result = resolveSource('Meditations (Penguin Classics)', existing)
    expect(result).toEqual({ kind: 'existing', source: existing[0] })
  })

  it('proposes a new source for anything not confidently the same book', () => {
    expect(resolveSource('The Civil War by Shelby Foote', existing)).toEqual({
      kind: 'new',
      title: 'The Civil War',
      author: 'Shelby Foote',
    })
  })

  it('proposes a new source, unauthored, for a bare place or person', () => {
    expect(resolveSource('A friend, on a walk', existing)).toEqual({
      kind: 'new',
      title: 'A friend, on a walk',
      author: '',
    })
  })

  // The bar here is deliberately stricter than the Kobo importer's 0.6 —
  // this attaches silently mid-capture rather than asking first, so it
  // should only fire on what's unambiguously the same title.
  it('does NOT reuse a merely similar title — that is the importer\'s job, with a human confirming', () => {
    const looksClose = [source({ id: 's2', title: 'Letters to a Young Poet' })]
    const result = resolveSource('Letters to a Young Novelist', looksClose)
    expect(result.kind).toBe('new')
    expect(CAPTURE_MATCH_THRESHOLD).toBeGreaterThan(0.6)
  })

  it('picks the closer of two candidates when both clear the bar', () => {
    const both = [
      source({ id: 's1', title: 'Meditations' }),
      source({ id: 's2', title: 'Meditations: A New Translation' }),
    ]
    const result = resolveSource('Meditations', both)
    expect(result).toEqual({ kind: 'existing', source: both[0] })
  })
})

describe('sourceInputValue', () => {
  it('is empty for no source', () => {
    expect(sourceInputValue(undefined)).toBe('')
  })

  it('renders "title by author" when there is an author', () => {
    expect(sourceInputValue(source({ title: 'Meditations', author: 'Marcus Aurelius' }))).toBe(
      'Meditations by Marcus Aurelius',
    )
  })

  it('renders just the title when there is no author', () => {
    expect(sourceInputValue(source({ title: 'A friend, on a walk', author: '' }))).toBe('A friend, on a walk')
  })

  it('round-trips through parseSourceInput', () => {
    const original = source({ title: 'The Civil War', author: 'Shelby Foote' })
    expect(parseSourceInput(sourceInputValue(original))).toEqual({ title: 'The Civil War', author: 'Shelby Foote' })
  })
})
