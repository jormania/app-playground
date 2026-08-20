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
