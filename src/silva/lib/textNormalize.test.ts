import { describe, it, expect } from 'vitest'
import { normalizeCapturedText } from './textNormalize'

describe('normalizeCapturedText', () => {
  it('normalises CRLF and lone CR to LF', () => {
    expect(normalizeCapturedText('one\r\ntwo\rthree')).toBe('one\ntwo\nthree')
  })

  it('strips trailing space and tabs at the end of every line', () => {
    expect(normalizeCapturedText('one   \ntwo\t\t\nthree')).toBe('one\ntwo\nthree')
  })

  it('collapses three or more consecutive newlines to a single blank line', () => {
    expect(normalizeCapturedText('one\n\n\n\n\ntwo')).toBe('one\n\ntwo')
  })

  // A run of exactly one blank line is a real, deliberate paragraph break
  // and must survive untouched.
  it('leaves a single blank line between paragraphs exactly as it was', () => {
    expect(normalizeCapturedText('one\n\ntwo')).toBe('one\n\ntwo')
  })

  it('swaps a non-breaking space for an ordinary one', () => {
    expect(normalizeCapturedText('one\u00A0two')).toBe('one two')
  })

  it('trims leading and trailing whitespace from the whole block', () => {
    expect(normalizeCapturedText('\n\n  one two  \n\n')).toBe('one two')
  })

  // The whole point: fix whitespace, never touch words. A deliberate
  // single line break, an intra-line run of spaces (a poem, a table
  // copied as text), and every word are exactly as pasted.
  it('never touches a single newline, intra-line spacing, or any word', () => {
    const poem = 'Line one\nLine   two,   spaced\nLine three'
    expect(normalizeCapturedText(poem)).toBe(poem)
  })

  it('is idempotent — already-clean text is unchanged on a second pass', () => {
    const clean = 'A tidy passage.\n\nWith one real paragraph break.'
    expect(normalizeCapturedText(normalizeCapturedText(clean))).toBe(clean)
  })

  // The bug this exists for: a note app's multi-paragraph text, pasted,
  // used to render as one run-on wall of text once the app's own <p>
  // collapsed the newlines it did preserve — this is the other half of
  // that fix, cleaning up what a badly-formatted source adds on top.
  it('turns a messily-copied multi-paragraph note into something legible', () => {
    const messy = 'First point.  \r\n\r\n\r\n\r\nSecond point. Third point.\t\n'
    expect(normalizeCapturedText(messy)).toBe('First point.\n\nSecond point. Third point.')
  })

  it('leaves empty text empty', () => {
    expect(normalizeCapturedText('')).toBe('')
    expect(normalizeCapturedText('   \n\n  ')).toBe('')
  })
})
