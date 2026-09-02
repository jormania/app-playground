import { describe, it, expect } from 'vitest'
import { findLinkDuplicate, duplicateNotice } from './linkDuplicate'
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
