/**
 * Notion rich-text encoding, in one place for all four of Silva's mappings.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * Notion caps a single rich-text element's `content` at **2000 characters**
 * and rejects the whole request with a 400 if you exceed it. Every one of
 * Silva's four mappings (notion.ts, sources.ts, loci.ts, paths.ts) had its
 * own identical `richText` helper that emitted exactly one unbounded
 * element, so any value over that limit failed the write outright.
 *
 * That matters more here than in any other app in this repo, because Silva
 * is the one whose entire purpose is keeping *passages*. A page photographed
 * and transcribed, a long Kobo highlight, a pasted article excerpt, a note
 * written at length — all routinely clear 2000 characters. The failure was
 * silent in the worst way: the optimistic write showed the capture landing,
 * then the write-through 400'd, the state rolled back, and the passage was
 * gone with only a toast to say so.
 *
 * Loom already solved this (src/loom/lib/notion.js's `plainToRichText`); this
 * is the same fix, typed, shared across Silva's four mappings so it can't
 * drift back apart. Notion allows up to 100 elements per property, so at
 * 2000 characters each this accommodates 200,000 characters — far past
 * anything a commonplace book holds in one field.
 */

export const RICH_TEXT_LIMIT = 2000

export interface RichTextChunk {
  text: { content: string }
}

/** Splits a plain string into Notion rich-text elements at the API's
 *  per-element character limit. Empty/absent input is `[]`, which is how
 *  Notion clears a rich-text property. */
export function toRichTextChunks(value: string | null | undefined, limit = RICH_TEXT_LIMIT): RichTextChunk[] {
  const text = value == null ? '' : String(value)
  if (text.length === 0) return []
  const chunks: RichTextChunk[] = []
  for (let i = 0; i < text.length; i += limit) {
    chunks.push({ text: { content: text.slice(i, i + limit) } })
  }
  return chunks
}

/** A `rich_text` property payload — the shape every `toNotion*Props` writes. */
export function richText(value: string | null | undefined) {
  return { rich_text: toRichTextChunks(value) }
}

/**
 * A `title` property payload. Notion applies the same 2000-character limit
 * per element here, so titles chunk too — Silva's own titles are short by
 * construction (`deriveHandle` caps at 60, `deriveLabel` joins two of them),
 * but a Source title comes from Kobo's EPUB metadata, which is not something
 * this app controls.
 */
export function title(value: string | null | undefined) {
  const chunks = toRichTextChunks(value)
  // A title must exist even when empty, unlike rich_text — an empty array
  // reads back as an untitled row rather than failing, and that is the
  // correct representation of "no handle yet".
  return { title: chunks }
}
