import { describe, it, expect } from 'vitest'
import { comparableUrl, sameLink, findLinkDuplicate, duplicateNotice } from './linkDuplicate'
import type { Thing } from './notion'

const URL = 'https://www.thisiscolossal.com/2026/08/minyoung-kim/'

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: 't1',
    handle: 'a',
    body: 'Mischievous Cats Rule',
    kind: 'Link',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-08-18',
    kept: '2026-08-18',
    note: '',
    lociIds: [],
    image: null,
    link: URL,
    koboBookmarkId: null,
    arrived: null,
    ...over,
  }
}

describe('comparableUrl', () => {
  it('ignores what a share picks up on the way', () => {
    expect(sameLink(URL, `${URL}?utm_source=newsletter&utm_medium=email`)).toBe(true)
    expect(sameLink(URL, `${URL}?fbclid=abc123`)).toBe(true)
    expect(sameLink(URL, `${URL}#the-paintings`)).toBe(true)
  })

  it('ignores www, a trailing slash and parameter order', () => {
    expect(sameLink(URL, 'https://thisiscolossal.com/2026/08/minyoung-kim')).toBe(true)
    expect(sameLink('https://x.dev/a?b=1&c=2', 'https://x.dev/a?c=2&b=1')).toBe(true)
  })

  it('keeps parameters that say which page this is', () => {
    expect(sameLink('https://x.dev/read?id=1', 'https://x.dev/read?id=2')).toBe(false)
    expect(sameLink('https://youtu.be/x?t=90', 'https://youtu.be/x')).toBe(false)
  })

  it('does not confuse two hosts, two paths or two schemes', () => {
    expect(sameLink('https://x.dev/a', 'https://y.dev/a')).toBe(false)
    expect(sameLink('https://x.dev/a', 'https://x.dev/b')).toBe(false)
    expect(sameLink('https://x.dev/a', 'http://x.dev/a')).toBe(false)
  })

  it('falls back to the plain string when the URL will not parse', () => {
    expect(comparableUrl('  Not A Url ')).toBe('not a url')
    expect(sameLink('not a url', 'NOT A URL')).toBe(true)
  })
})

describe('findLinkDuplicate', () => {
  it('finds the thing already holding this link', () => {
    expect(findLinkDuplicate([thing()], `${URL}?utm_source=x`)?.id).toBe('t1')
  })

  // A row written straight into Notion, or one kept before Silva filled
  // `link` at intake, carries its URL in the body instead.
  it('finds one whose URL is still in its body', () => {
    const older = thing({ id: 't2', link: null, body: URL })
    expect(findLinkDuplicate([older], URL)?.id).toBe('t2')
  })

  it('prefers the most recently encountered copy', () => {
    const older = thing({ id: 'old', encountered: '2026-01-01' })
    const newer = thing({ id: 'new', encountered: '2026-08-18' })
    expect(findLinkDuplicate([older, newer], URL)?.id).toBe('new')
  })

  it('is silent about anything else', () => {
    expect(findLinkDuplicate([thing()], 'https://example.com/other')).toBeNull()
    expect(findLinkDuplicate([thing()], null)).toBeNull()
    expect(findLinkDuplicate([thing()], '   ')).toBeNull()
    expect(findLinkDuplicate([thing({ link: null, body: 'a passage' })], URL)).toBeNull()
  })
})

describe('duplicateNotice', () => {
  it("says it in the app's own words for each state", () => {
    expect(duplicateNotice(thing())).toBe('You already have this — grown 2026-08-18.')
    expect(duplicateNotice(thing({ state: 'Understory', kept: null })))
      .toBe('This is already in the nursery — sown 2026-08-18.')
  })

  it('falls back to the encountered date for a kept thing with no kept date', () => {
    expect(duplicateNotice(thing({ kept: null }))).toBe('You already have this — grown 2026-08-18.')
  })

  it('says nothing when there is nothing to say', () => {
    expect(duplicateNotice(null)).toBeNull()
  })
})
