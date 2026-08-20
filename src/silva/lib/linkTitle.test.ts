import { describe, it, expect } from 'vitest'
import { linkTitlePatch } from './linkTitle'
import type { Thing } from './notion'
import type { LinkPreview } from './linkPreviewCache'

const URL = 'https://nesslabs.com/jomo'

function thing(overrides: Partial<Thing> = {}): Thing {
  return {
    id: 't1',
    handle: URL,
    body: URL,
    kind: 'Link',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-08-20',
    kept: '2026-08-20',
    note: '',
    lociIds: [],
    image: null,
    link: URL,
    koboBookmarkId: null,
    ...overrides,
  }
}

function preview(overrides: Partial<LinkPreview> = {}): LinkPreview {
  return {
    title: 'The joy of missing out',
    description: 'JOMO — the joy of missing out — is a way to live an intentional life.',
    image: null,
    siteName: 'Ness Labs',
    url: URL,
    ...overrides,
  }
}

describe('linkTitlePatch', () => {
  it('gives a bare-URL body the article title', () => {
    expect(linkTitlePatch(thing(), preview())).toEqual({ body: 'The joy of missing out' })
  })

  // The handle is the Notion row's title and `SilvaStore.updateThing`
  // re-derives it from a changed body — patching it here as well would only
  // be a second, divergent source of truth.
  it('leaves the handle to the store to re-derive', () => {
    expect(linkTitlePatch(thing(), preview())).not.toHaveProperty('handle')
  })

  it('collapses whitespace in a title split across lines', () => {
    expect(linkTitlePatch(thing(), preview({ title: '  The joy\n  of missing out ' }))).toEqual({
      body: 'The joy of missing out',
    })
  })

  // The rule that keeps this safe: anything that isn't a placeholder URL is
  // something you wrote, and is never touched.
  it('never overwrites a body you wrote yourself', () => {
    expect(linkTitlePatch(thing({ body: 'A note about JOMO, with the link below.' }), preview())).toBeNull()
    expect(linkTitlePatch(thing({ body: `Worth reading: ${URL}` }), preview())).toBeNull()
  })

  it('never overwrites a link already retitled by hand', () => {
    expect(linkTitlePatch(thing({ body: 'The JOMO piece' }), preview())).toBeNull()
  })

  it('does nothing without a preview, a title, or a link', () => {
    expect(linkTitlePatch(thing(), null)).toBeNull()
    expect(linkTitlePatch(thing(), preview({ title: null }))).toBeNull()
    expect(linkTitlePatch(thing(), preview({ title: '   ' }))).toBeNull()
    expect(linkTitlePatch(thing({ link: null }), preview())).toBeNull()
  })

  it('refuses a title that is only the URL again', () => {
    expect(linkTitlePatch(thing(), preview({ title: URL }))).toBeNull()
    expect(linkTitlePatch(thing(), preview({ title: 'https://example.com/other' }))).toBeNull()
  })

  it('refuses a standfirst-length title — that is a page dump, not a headline', () => {
    expect(linkTitlePatch(thing(), preview({ title: 'A'.repeat(201) }))).toBeNull()
    expect(linkTitlePatch(thing(), preview({ title: 'A'.repeat(200) }))).toEqual({ body: 'A'.repeat(200) })
  })
})
