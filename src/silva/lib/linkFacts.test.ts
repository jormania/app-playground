import { describe, it, expect } from 'vitest'
import { linkTitlePatch, linkLocatorPatch, linkFactsPatch, linkSourceTitle } from './linkFacts'
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
    arrived: null,
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

describe('linkLocatorPatch', () => {
  it('prints the byline and year on the label', () => {
    expect(linkLocatorPatch(thing(), preview({ author: 'Anne-Laure Le Cunff', publishedYear: '2021' }))).toEqual({
      locator: 'Anne-Laure Le Cunff · 2021',
    })
  })

  it('prints whichever of the two the page actually declares', () => {
    expect(linkLocatorPatch(thing(), preview({ author: 'Maria Popova' }))).toEqual({ locator: 'Maria Popova' })
    expect(linkLocatorPatch(thing(), preview({ publishedYear: '2019' }))).toEqual({ locator: '2019' })
  })

  // "overheard on the 32 tram" outranks anything a meta tag has to say.
  it('never touches a locator you wrote', () => {
    const mine = thing({ locator: 'sent by R.' })
    expect(linkLocatorPatch(mine, preview({ author: 'Maria Popova' }))).toBeNull()
  })

  it('does nothing when the page declares neither', () => {
    expect(linkLocatorPatch(thing(), preview())).toBeNull()
    // A preview cached before these fields existed carries neither.
    expect(linkLocatorPatch(thing(), preview({ author: undefined, publishedYear: undefined }))).toBeNull()
  })
})

describe('linkFactsPatch', () => {
  it('folds the title and the label into one patch', () => {
    expect(linkFactsPatch(thing(), preview({ author: 'Anne-Laure Le Cunff', publishedYear: '2021' }))).toEqual({
      body: 'The joy of missing out',
      locator: 'Anne-Laure Le Cunff · 2021',
    })
  })

  it('carries whichever half applies', () => {
    expect(linkFactsPatch(thing({ locator: 'sent by R.' }), preview())).toEqual({ body: 'The joy of missing out' })
    expect(linkFactsPatch(thing({ body: 'My own words.' }), preview({ author: 'Maria Popova' }))).toEqual({
      locator: 'Maria Popova',
    })
  })

  it('is null when the page had nothing this thing lacked', () => {
    expect(linkFactsPatch(thing({ body: 'My own words.', locator: 'sent by R.' }), preview())).toBeNull()
  })
})

describe('linkSourceTitle', () => {
  it('files a link under the publication that ran it', () => {
    expect(linkSourceTitle(thing(), preview())).toBe('Ness Labs')
  })

  // A piece you found through someone else, filed under them, stays theirs.
  it('never overrides a source you set', () => {
    expect(linkSourceTitle(thing({ sourceId: 'src-1' }), preview())).toBeNull()
  })

  it('does nothing without a preview or a link', () => {
    expect(linkSourceTitle(thing(), null)).toBeNull()
    expect(linkSourceTitle(thing({ link: null }), preview())).toBeNull()
    expect(linkSourceTitle(thing(), preview({ siteName: '  ' }))).toBeNull()
  })
})
