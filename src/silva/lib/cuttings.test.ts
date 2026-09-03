import { describe, it, expect } from 'vitest'
import { cuttingsFrom, cuttingGist } from './cuttings'
import type { Thing } from './notion'

const URL = 'https://www.thisiscolossal.com/2026/08/minyoung-kim/'

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: 't1',
    handle: 'a',
    body: 'A passage',
    kind: null,
    state: 'Kept',
    sourceId: 's1',
    locator: '',
    encountered: '2026-09-01',
    kept: '2026-09-01',
    note: '',
    lociIds: [],
    image: null,
    link: URL,
    koboBookmarkId: null,
    arrived: null,
    ...over,
  }
}

describe('cuttingsFrom', () => {
  const article = thing({ id: 'article', body: 'Mischievous Cats Rule', kind: 'Link' })

  it('finds what came out of the same page', () => {
    const one = thing({ id: 'c1', body: 'First passage', encountered: '2026-09-02' })
    const two = thing({ id: 'c2', body: 'Second passage', encountered: '2026-09-03' })
    expect(cuttingsFrom(article, [article, one, two]).map((t) => t.id)).toEqual(['c2', 'c1'])
  })

  it('never counts the thing itself', () => {
    expect(cuttingsFrom(article, [article])).toEqual([])
  })

  // Campaign tags don't make it a different page — the same rule the share
  // lane's duplicate notice uses.
  it('sees through the tracking tags a link arrived wearing', () => {
    const cutting = thing({ id: 'c1', link: `${URL}?utm_source=newsletter` })
    expect(cuttingsFrom(article, [article, cutting]).map((t) => t.id)).toEqual(['c1'])
  })

  it('leaves out another page, and anything let go', () => {
    const elsewhere = thing({ id: 'x', link: 'https://example.com/other' })
    const released = thing({ id: 'r', state: 'Released' })
    expect(cuttingsFrom(article, [article, elsewhere, released])).toEqual([])
  })

  // A cutting still in the nursery counts — it is the one you most need to be
  // reminded of, since it has not been decided about yet.
  it('counts one still waiting in the nursery', () => {
    const waiting = thing({ id: 'c1', state: 'Understory', kept: null })
    expect(cuttingsFrom(article, [article, waiting]).map((t) => t.id)).toEqual(['c1'])
  })

  it('says nothing about a thing with no page behind it', () => {
    const passage = thing({ id: 'p', link: null, body: 'Just a passage.' })
    expect(cuttingsFrom(passage, [passage, thing({ id: 'c1' })])).toEqual([])
  })

  // The URL can still be sitting in the body of an older row.
  it('reads a URL out of a body that never got a link field', () => {
    const older = thing({ id: 'old', link: null, body: URL })
    const cutting = thing({ id: 'c1' })
    expect(cuttingsFrom(older, [older, cutting]).map((t) => t.id)).toEqual(['c1'])
  })
})

describe('cuttingGist', () => {
  it('gives enough to recognise it by', () => {
    expect(cuttingGist(thing({ body: 'Short one.' }))).toBe('Short one.')
    expect(cuttingGist(thing({ body: 'a'.repeat(100) }))).toBe(`${'a'.repeat(80)}…`)
  })

  it('flattens the shape without changing the words', () => {
    expect(cuttingGist(thing({ body: '  two\n\nlines  ' }))).toBe('two lines')
  })
})
