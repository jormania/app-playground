/**
 * Structural hygiene for a captured body — never editorial cleanup.
 *
 * A paste carries artifacts of *how it travelled*, not of what was written:
 * `\r\n` line endings from one platform, a soft hyphen a browser injected to
 * justify a column, a zero-width space a CMS uses as a line-break hint, a
 * form feed marking a PDF page boundary, an "é" encoded as two code points
 * on one machine and one on another. None of that is the passage. Removing
 * it is the same read-don't-infer move `isBareUrl`/`intakeKind` already make
 * elsewhere in intake.
 *
 * ── The line this must not cross ─────────────────────────────────────────
 * **Normalization** makes text structurally consistent without changing what
 * it says. **Editorial cleanup** makes judgment calls — re-punctuating,
 * re-paragraphing, re-capitalising, "fixing" spacing that might be
 * deliberate. Silva does the first and never the second: a commonplace book
 * holds other people's sentences, and a passage's shape is part of the
 * passage. A poem's indentation, a run of spaces in a copied table, an
 * author's em dash habit, a deliberate lowercase opening — all survive
 * untouched. When a transformation *could* be either, it doesn't happen.
 *
 * Every rule below is reversible-in-meaning: you could show the before and
 * after to the person who wrote it and they would read the same sentence.
 *
 * ── Deliberately NOT done, and why ───────────────────────────────────────
 * - **De-hyphenating line breaks** (`inter-\nesting` → `interesting`). The
 *   single highest-value cleanup for PDF and OCR text, and impossible to do
 *   honestly: `well-\nknown` is a real hyphen, `inter-\nesting` is not, and
 *   telling them apart needs a dictionary and still guesses. Editorial.
 * - **Straightening or curling quotes and dashes.** `"` ↔ `"`, `—` → `--`.
 *   Pure typography, which is to say pure style. Never ours to change.
 * - **Collapsing runs of spaces inside a line.** Sometimes a justification
 *   artifact, sometimes a poem, sometimes a table pasted as text. Unknowable.
 * - **Expanding tabs.** How wide is a tab? That's a rendering opinion.
 * - **NFKC normalization.** NFC's compatibility-mode sibling would rewrite
 *   `ﬁ` → `fi`, `½` → `1⁄2`, `①` → `1`, and flatten 𝐛𝐨𝐥𝐝 mathematical
 *   letters to plain ASCII. That is a visible restyling of someone's text.
 *   NFC (below) is the safe half: same glyphs, canonical encoding.
 * - **Stripping ZWJ/ZWNJ** (U+200C/U+200D). Invisible, but load-bearing:
 *   ZWJ builds emoji sequences (👨‍👩‍👧 is three people joined by two of them),
 *   and both control ligature formation in Persian, Arabic and Indic
 *   scripts, where removing them changes the rendered word. The other
 *   zero-width characters below carry no such meaning.
 * - **Stripping bidi controls** (U+202A–U+202E, U+2066–U+2069). Genuinely
 *   meaningful in mixed RTL/LTR text. A quotation in Hebrew or Arabic may
 *   need them to render correctly at all.
 * - **Removing U+FFFD**, the replacement character. It marks where an
 *   encoding already failed; deleting it hides the damage rather than
 *   repairing it. Better to leave the scar visible.
 * - **U+3000, the ideographic space.** A full-width space is the correct,
 *   intentional space character in Japanese and Chinese typography — not an
 *   artifact. The Western variable-width spaces below are.
 */

/** Line endings. CR-LF (Windows) and lone CR (classic Mac, some exports). */
const CRLF_OR_CR = /\r\n?/g

/**
 * Unicode's own line and paragraph separators, emitted by InDesign, some
 * PDF extractors and older macOS apps. They *are* breaks — they just aren't
 * the ones anything downstream understands, and they're invisible when they
 * fail. U+2029 is a paragraph break, so it earns a blank line.
 */
const PARAGRAPH_SEPARATOR = /\u2029/g
const LINE_SEPARATOR = /\u2028/g

/**
 * Vertical tab and form feed. Word uses U+000B for a soft line break; a form
 * feed is a page boundary in plain-text and PDF exports. Both mean "break
 * here", so both become one.
 */
// `no-control-regex` exists because a control character in a pattern is
// nearly always a typo. Here it is the entire subject: this module's job
// is to find control characters and take them out. Disabled for these two
// patterns only, and nowhere else in the file.
// eslint-disable-next-line no-control-regex
const VERTICAL_BREAKS = /[\u000B\u000C]/g

/**
 * The remaining C0 controls plus DEL — NUL padding, stray ESC, the debris of
 * a bad encoding or a binary file read as text. Never meaningful in prose.
 * Tab and newline are excluded: they're structure, and handled above.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000E-\u001F\u007F]/g

/**
 * Invisible characters with no semantic weight in prose:
 *   U+00AD soft hyphen — a hyphenation *hint*; renders as nothing unless the
 *           renderer decides to break there, so in stored text it is noise
 *           that also silently breaks search ("understory").
 *   U+200B zero-width space — a CMS/line-breaking hint.
 *   U+2060 word joiner — the inverse hint.
 *   U+FEFF byte-order mark / zero-width no-break space — a file-format
 *           artifact that arrives at the head of a paste from a UTF-8 file.
 * ZWJ and ZWNJ are deliberately absent — see the header.
 */
const INVISIBLE_CHARACTERS = /[\u00AD\u200B\u2060\uFEFF]/g

/**
 * Fixed-width and no-break spaces, overwhelmingly the residue of justified
 * text: PDF extraction, HTML `&nbsp;`, a word processor's own spacing.
 * U+2000–U+200A are the variable-width typographic spaces; U+202F is the
 * narrow no-break space; U+205F the medium mathematical space. All become an
 * ordinary space — same word boundary, one canonical character. (U+3000, the
 * ideographic space, is excluded — see the header.)
 */
const SPACE_VARIANTS = /[\u00A0\u2000-\u200A\u202F\u205F]/g

/** Trailing space and tab at a line's end: invisible, and never intentional. */
const TRAILING_LINE_WHITESPACE = /[ \t]+$/gm

/**
 * Three or more newlines → one blank line. A single blank line is a real
 * paragraph break and survives; six of them are a note app's section
 * padding, not six paragraphs' worth of silence.
 */
const THREE_OR_MORE_NEWLINES = /\n{3,}/g

/**
 * Cleans a captured body's *structure*, leaving every word, every deliberate
 * line break, and every stylistic choice exactly as written.
 *
 * In order: line endings and Unicode separators become `\n`; vertical breaks
 * become `\n`; control characters and invisible formatting characters are
 * dropped; typographic spaces become ordinary spaces; the text is put into
 * Unicode NFC; trailing line whitespace goes; runs of blank lines collapse to
 * one; the block is trimmed.
 *
 * **NFC** is the part that isn't about whitespace at all, and it's the one
 * doing the quietest work. "é" can be U+00E9, or "e" followed by combining
 * acute U+0301 — identical on screen, different strings to every comparison
 * in the app. macOS filenames and some IMEs produce the decomposed form,
 * most web pages the composed one. Without this, two captures of the same
 * sentence can fail to match in Forage, dedupe as distinct, and embed to
 * different vectors. NFC is canonical composition only: it never changes
 * which glyphs are shown, only how they're spelled in memory.
 *
 * Idempotent by construction — every rule maps to a fixed point, so a second
 * pass over already-clean text (an OCR transcription, a Kobo highlight, a
 * body normalised at capture and normalised again on edit) changes nothing.
 */
export function normalizeCapturedText(text: string): string {
  return text
    .replace(CRLF_OR_CR, '\n')
    .replace(PARAGRAPH_SEPARATOR, '\n\n')
    .replace(LINE_SEPARATOR, '\n')
    .replace(VERTICAL_BREAKS, '\n')
    .replace(CONTROL_CHARACTERS, '')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(SPACE_VARIANTS, ' ')
    // After the invisibles are gone, so a combining mark separated from its
    // base by a stray zero-width character can still compose properly.
    .normalize('NFC')
    .replace(TRAILING_LINE_WHITESPACE, '')
    .replace(THREE_OR_MORE_NEWLINES, '\n\n')
    .trim()
}
