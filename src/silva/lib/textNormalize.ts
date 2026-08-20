/**
 * Whitespace hygiene for a captured body — never anything more than that.
 *
 * A paste can arrive with artifacts that have nothing to do with what was
 * actually written: `\r\n` line endings from one platform, trailing spaces
 * left at a line's end by whatever the words were selected in, a run of six
 * blank lines because a note app pads sections generously, a non-breaking
 * space swapped in by a web page's own layout. None of that is the passage
 * — it's noise the copy mechanism added, and cleaning it up is exactly the
 * kind of reading-not-inferring move `isBareUrl`/`intakeKind` already make
 * elsewhere in this app.
 *
 * The rule this stays inside: fix whitespace, never touch words. No
 * reflowing, no re-punctuating, no "smart" restructuring of prose that
 * merely *looks* messy — a deliberate single line break, a poem's own
 * spacing, an intentional run of dashes are exactly as much the passage as
 * its words are, and this must never guess which ones you meant.
 */

const CRLF_OR_CR = /\r\n?/g
const TRAILING_LINE_WHITESPACE = /[ \t]+$/gm
const THREE_OR_MORE_NEWLINES = /\n{3,}/g
const NBSP = /\u00A0/g

/**
 * Cleans a captured body's whitespace: normalises line endings, drops
 * trailing space/tab at the end of every line, collapses three-or-more
 * consecutive newlines down to a single blank line, swaps a non-breaking
 * space for an ordinary one, and trims the whole block. Never touches
 * anything else — a single newline, an intra-line run of spaces, and every
 * word are left exactly as pasted.
 *
 * Idempotent, so it's safe to run on text that's already clean (an OCR
 * transcription, a Kobo highlight, or a body re-normalised on a second
 * paste) — nothing here changes on a second pass.
 */
export function normalizeCapturedText(text: string): string {
  return text
    .replace(CRLF_OR_CR, '\n')
    .replace(NBSP, ' ')
    .replace(TRAILING_LINE_WHITESPACE, '')
    .replace(THREE_OR_MORE_NEWLINES, '\n\n')
    .trim()
}
