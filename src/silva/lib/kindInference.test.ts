import { describe, it, expect } from 'vitest'
import { inferKind, isBareUrl, intakeKind } from './kindInference'

describe('inferKind', () => {
  it('returns null for empty text', () => {
    expect(inferKind('', true)).toBeNull()
    expect(inferKind('   ', false)).toBeNull()
  })

  it('detects a bare URL as Link', () => {
    expect(inferKind('https://example.com/some/article', false)).toBe('Link')
    expect(inferKind('http://example.com', true)).toBe('Link')
  })

  it('detects a question by its trailing "?"', () => {
    expect(inferKind('What would you do if you weren\'t afraid?', false)).toBe('Question')
  })

  it('detects quoted dialogue', () => {
    expect(inferKind('She said, "I have never once regretted staying."', false)).toBe('Dialogue')
    expect(inferKind('“Probably the same thing, honestly.”', false)).toBe('Dialogue')
  })

  it('does not mistake a short quoted phrase for dialogue', () => {
    // Under the 8-char quoted-run floor — a quoted word, not speech.
    expect(inferKind('The word "delight" keeps coming up.', true)).not.toBe('Dialogue')
  })

  it('falls back to Fragment for very short text', () => {
    expect(inferKind('Worth remembering.', true)).toBe('Fragment')
  })

  it('falls back to Passage when a source is set', () => {
    const body = 'A library is organized so you can find what you already know you want. A forest is organized so you can find what you did not know you were looking for.'
    expect(inferKind(body, true)).toBe('Passage')
  })

  it('falls back to Observation when no source is set', () => {
    const body = 'A dog sat at the tram stop for twenty minutes, watching every door open and close, waiting for someone who never came.'
    expect(inferKind(body, false)).toBe('Observation')
  })
})

describe('isBareUrl', () => {
  it('is true for a body that is nothing but a URL', () => {
    expect(isBareUrl('https://example.com/some/article')).toBe(true)
    expect(isBareUrl('  http://example.com  ')).toBe(true)
  })

  it('is false for a URL with any surrounding words', () => {
    expect(isBareUrl('See https://example.com for more')).toBe(false)
    expect(isBareUrl('https://example.com — worth a read')).toBe(false)
  })

  it('is false for ordinary text', () => {
    expect(isBareUrl('Worth remembering.')).toBe(false)
    expect(isBareUrl('')).toBe(false)
  })
})

describe('inferKind — a thing that carries a link', () => {
  // A kept link's body becomes the article's title (lib/linkTitle.ts), so
  // the URL is no longer in the text — the `link` field is what still says
  // "Link", and Suggest has to read it or it starts proposing Observation
  // for every link in the forest.
  it('suggests Link from the link field alone', () => {
    expect(inferKind('The joy of missing out', false, true)).toBe('Link')
    expect(inferKind('The joy of missing out', false, false)).not.toBe('Link')
  })
})

describe('intakeKind', () => {
  // The one Kind set at capture. A pasted link arrives labelled `Link`
  // rather than waiting on a trip to Edit and a tap of Suggest.
  it('labels a pasted bare URL as Link', () => {
    expect(intakeKind('https://nesslabs.com/jomo')).toBe('Link')
    expect(intakeKind('  http://example.com  ')).toBe('Link')
  })

  // Everything else stays a judgment made later, or never — intake still
  // captures no metadata it has to guess at.
  it('leaves every other capture unlabelled', () => {
    expect(intakeKind('Worth reading: https://nesslabs.com/jomo')).toBeNull()
    expect(intakeKind('What would you do if you weren\'t afraid?')).toBeNull()
    expect(intakeKind('')).toBeNull()
  })
})
