import { describe, it, expect } from 'vitest'
import { intakeFields } from './intakeFields'

const URL = 'https://nesslabs.com/jomo'

describe('intakeFields', () => {
  it('reads a pasted bare URL as the link, and as a Link', () => {
    expect(intakeFields(URL)).toEqual({ body: URL, locator: '', link: URL, kind: 'Link' })
  })

  // The share-sheet lane: sharedIntake puts the URL in the locator and the
  // page title in the body. Left there, the thing got no preview card, no
  // Link kind and no article title — the whole point of a Link thing.
  it('promotes a shared URL out of the locator into the link', () => {
    expect(intakeFields('The joy of missing out', URL)).toEqual({
      body: 'The joy of missing out',
      locator: '',
      link: URL,
      kind: 'Link',
    })
  })

  it('leaves a locator that is prose alone', () => {
    expect(intakeFields('Something overheard.', 'on the 32 tram')).toEqual({
      body: 'Something overheard.',
      locator: 'on the 32 tram',
      link: null,
      kind: null,
    })
  })

  // A URL inside a sentence you wrote is part of the sentence.
  it('never picks a URL out of prose, in either field', () => {
    expect(intakeFields(`Worth reading: ${URL}`)).toMatchObject({ link: null, kind: null })
    expect(intakeFields('A passage.', `overheard, then ${URL}`)).toMatchObject({
      link: null,
      locator: `overheard, then ${URL}`,
    })
  })

  it('prefers the body when both are bare URLs, and keeps the locator intact', () => {
    expect(intakeFields(URL, 'https://example.com/other')).toMatchObject({
      link: URL,
      locator: 'https://example.com/other',
    })
  })

  it('tolerates surrounding whitespace', () => {
    expect(intakeFields(`  ${URL}  `)).toMatchObject({ link: URL, kind: 'Link' })
    expect(intakeFields('A title', `  ${URL}  `)).toMatchObject({ link: URL, kind: 'Link' })
  })
})

describe('intakeFields — the tracking tags a link arrives wearing', () => {
  it('takes them off a pasted URL, body and link together', () => {
    const fields = intakeFields('https://x.dev/essay?utm_source=newsletter')
    expect(fields).toEqual({
      body: 'https://x.dev/essay',
      locator: '',
      link: 'https://x.dev/essay',
      kind: 'Link',
    })
  })

  it('takes them off a URL arriving in the locator from the share sheet', () => {
    const fields = intakeFields('A note', 'https://x.dev/essay?fbclid=abc')
    expect(fields).toEqual({ body: 'A note', locator: '', link: 'https://x.dev/essay', kind: 'Link' })
  })

  // The body is only ever touched when it *is* the link — anything you wrote
  // comes back exactly as written, tracking-shaped or not.
  it('never touches a body that is anything but the URL itself', () => {
    const prose = 'Read at https://x.dev/essay?utm_source=newsletter, worth it'
    expect(intakeFields(prose)).toEqual({ body: prose, locator: '', link: null, kind: null })
  })

  it('leaves a URL with nothing to strip exactly as it arrived', () => {
    const url = 'https://x.dev/essay?id=17'
    expect(intakeFields(url).link).toBe(url)
    expect(intakeFields(url).body).toBe(url)
  })
})
