import { describe, it, expect } from 'vitest'
import { normalizeCapturedText } from './textNormalize'

// Escapes rather than pasted literals: every character under test here is
// invisible, or indistinguishable from an ordinary space on screen, and a
// test you cannot read is a test you cannot trust.
const SHY = '\u00AD' // soft hyphen
const ZWSP = '\u200B' // zero-width space
const ZWNJ = '\u200C' // zero-width non-joiner
const ZWJ = '\u200D' // zero-width joiner
const WORD_JOINER = '\u2060'
const BOM = '\uFEFF'
const NBSP = '\u00A0'
const EN_SPACE = '\u2002'
const THIN_SPACE = '\u2009'
const NARROW_NBSP = '\u202F'
const IDEOGRAPHIC_SPACE = '\u3000'
const LINE_SEP = '\u2028'
const PARA_SEP = '\u2029'
const VTAB = '\u000B'
const FORM_FEED = '\u000C'
const NUL = '\u0000'
const ESC = '\u001B'
const REPLACEMENT = '\uFFFD'
const RLE = '\u202B' // right-to-left embedding
const PDF_BIDI = '\u202C' // pop directional formatting

describe('normalizeCapturedText — line structure', () => {
  it('normalises CRLF and lone CR to LF', () => {
    expect(normalizeCapturedText('one\r\ntwo\rthree')).toBe('one\ntwo\nthree')
  })

  it('turns a Unicode line separator into a line break', () => {
    expect(normalizeCapturedText(`one${LINE_SEP}two`)).toBe('one\ntwo')
  })

  // U+2029 means "paragraph", so it earns the blank line a paragraph gets.
  it('turns a Unicode paragraph separator into a paragraph break', () => {
    expect(normalizeCapturedText(`one${PARA_SEP}two`)).toBe('one\n\ntwo')
  })

  it('turns a vertical tab or form feed into a line break', () => {
    expect(normalizeCapturedText(`one${VTAB}two`)).toBe('one\ntwo')
    expect(normalizeCapturedText(`page one${FORM_FEED}page two`)).toBe('page one\npage two')
  })

  it('strips trailing space and tabs at the end of every line', () => {
    expect(normalizeCapturedText('one   \ntwo\t\t\nthree')).toBe('one\ntwo\nthree')
  })

  it('collapses three or more consecutive newlines to a single blank line', () => {
    expect(normalizeCapturedText('one\n\n\n\n\ntwo')).toBe('one\n\ntwo')
  })

  // A run of exactly one blank line is a real, deliberate paragraph break.
  it('leaves a single blank line between paragraphs exactly as it was', () => {
    expect(normalizeCapturedText('one\n\ntwo')).toBe('one\n\ntwo')
  })

  it('trims leading and trailing whitespace from the whole block', () => {
    expect(normalizeCapturedText('\n\n  one two  \n\n')).toBe('one two')
  })
})

describe('normalizeCapturedText — invisible characters', () => {
  // A soft hyphen is a hyphenation *hint*. Left in, it renders as nothing
  // and silently breaks any search for the word it sits inside.
  it('drops a soft hyphen, rejoining the word it split', () => {
    expect(normalizeCapturedText(`under${SHY}story`)).toBe('understory')
  })

  it('drops zero-width spaces, word joiners and byte-order marks', () => {
    expect(normalizeCapturedText(`Medi${ZWSP}tations`)).toBe('Meditations')
    expect(normalizeCapturedText(`one${WORD_JOINER}two`)).toBe('onetwo')
    expect(normalizeCapturedText(`${BOM}A passage.`)).toBe('A passage.')
  })

  it('drops stray control characters', () => {
    expect(normalizeCapturedText(`one${NUL}two${ESC}three`)).toBe('onetwothree')
  })

  // The sensitive limit: ZWJ and ZWNJ are invisible but load-bearing.
  // Stripping them corrupts emoji sequences and changes rendered words in
  // Persian, Arabic and Indic scripts.
  it('never strips a zero-width joiner, which would break an emoji sequence', () => {
    const family = `\u{1F468}${ZWJ}\u{1F469}${ZWJ}\u{1F467}`
    expect(normalizeCapturedText(family)).toBe(family)
  })

  it('never strips a zero-width non-joiner, which controls ligatures', () => {
    const persian = `می${ZWNJ}روم`
    expect(normalizeCapturedText(persian)).toBe(persian)
  })
})

describe('normalizeCapturedText — spaces', () => {
  it('swaps no-break, en, thin and narrow spaces for an ordinary space', () => {
    expect(normalizeCapturedText(`one${NBSP}two`)).toBe('one two')
    expect(normalizeCapturedText(`one${EN_SPACE}two`)).toBe('one two')
    expect(normalizeCapturedText(`one${THIN_SPACE}two`)).toBe('one two')
    expect(normalizeCapturedText(`one${NARROW_NBSP}two`)).toBe('one two')
  })

  // The sensitive limit: a full-width space is correct, intentional
  // typography in Japanese and Chinese — not a justification artifact.
  it('never touches the ideographic space', () => {
    const japanese = `こんにちは${IDEOGRAPHIC_SPACE}世界`
    expect(normalizeCapturedText(japanese)).toBe(japanese)
  })
})

describe('normalizeCapturedText — Unicode form', () => {
  // The quietest fix, and the one that isn't about whitespace at all: "é"
  // as e + combining acute is a different string from "é" as one code
  // point, so without this the same sentence captured twice can fail to
  // match in Forage, dedupe as distinct, and embed to different vectors.
  it('composes decomposed characters into NFC', () => {
    const decomposed = 'Cafe\u0301' // e + combining acute
    const composed = 'Caf\u00E9' // precomposed e-acute
    expect(decomposed).not.toBe(composed)
    expect(normalizeCapturedText(decomposed)).toBe(composed)
  })

  it('makes two encodings of the same sentence compare equal', () => {
    expect(normalizeCapturedText('a\u0300 la mode')).toBe(normalizeCapturedText('\u00E0 la mode'))
  })

  // The sensitive limit: NFKC would flatten every one of these, visibly
  // restyling someone's text. NFC leaves each glyph exactly as it renders.
  it('never applies compatibility folding to ligatures, fractions or styled letters', () => {
    expect(normalizeCapturedText('ﬁn de siecle')).toBe('ﬁn de siecle')
    expect(normalizeCapturedText('½ a loaf')).toBe('½ a loaf')
    expect(normalizeCapturedText('① first')).toBe('① first')
    expect(normalizeCapturedText('\u{1D401}old')).toBe('\u{1D401}old')
  })
})

/**
 * The whole discipline in one block: normalization makes text structurally
 * consistent, editorial cleanup makes judgment calls about what it says.
 * Everything here is a judgment call, so none of it happens.
 */
describe('normalizeCapturedText — never editorial', () => {
  it('never de-hyphenates a line break, which cannot be done honestly', () => {
    const pdf = 'a well-\nknown inter-\nesting case'
    expect(normalizeCapturedText(pdf)).toBe(pdf)
  })

  it('never straightens or curls quotes and dashes', () => {
    const styled = '“So it goes,” he said—briefly.'
    expect(normalizeCapturedText(styled)).toBe(styled)
  })

  it('never collapses runs of spaces inside a line', () => {
    const poem = 'Line one\nLine   two,   spaced\nLine three'
    expect(normalizeCapturedText(poem)).toBe(poem)
  })

  it('never expands or removes a leading tab or indent', () => {
    const indented = 'Stanza one\n\tindented line\n    four-space line'
    expect(normalizeCapturedText(indented)).toBe(indented)
  })

  it('never re-capitalises or re-punctuates', () => {
    const asWritten = 'i have no mouth and i must scream'
    expect(normalizeCapturedText(asWritten)).toBe(asWritten)
  })

  // A replacement character marks where an encoding already failed.
  // Deleting it would hide the damage rather than repair it.
  it('leaves the replacement character visible', () => {
    expect(normalizeCapturedText(`br${REPLACEMENT}ken`)).toBe(`br${REPLACEMENT}ken`)
  })

  it('never strips bidi controls, which are meaningful in RTL text', () => {
    const bidi = `${RLE}שלום${PDF_BIDI} and hello`
    expect(normalizeCapturedText(bidi)).toBe(bidi)
  })
})

describe('normalizeCapturedText — contract', () => {
  it('is idempotent — already-clean text is unchanged on a second pass', () => {
    const clean = 'A tidy passage.\n\nWith one real paragraph break.'
    expect(normalizeCapturedText(normalizeCapturedText(clean))).toBe(clean)
  })

  it('is idempotent even for text that needed every rule applied', () => {
    const messy = `${BOM}First point.  \r\n\r\n\r\n\r\nSecond${NBSP}po${SHY}int.\tCafé.\t\n`
    const once = normalizeCapturedText(messy)
    expect(normalizeCapturedText(once)).toBe(once)
  })

  it('leaves empty text empty', () => {
    expect(normalizeCapturedText('')).toBe('')
    expect(normalizeCapturedText('   \n\n  ')).toBe('')
  })

  // The bug this exists for, end to end: a messily-copied multi-paragraph
  // note becomes legible without a single word changing.
  it('turns a messily-copied multi-paragraph note into something legible', () => {
    const messy = `${BOM}First point.  \r\n\r\n\r\n\r\nSecond point.${NBSP}Third point.\t\n`
    expect(normalizeCapturedText(messy)).toBe('First point.\n\nSecond point. Third point.')
  })
})
