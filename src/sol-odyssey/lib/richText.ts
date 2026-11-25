// Notion rich-text encoding for every Sol Odyssey write, in one place.
//
// Notion caps a single rich-text element's `content` at 2000 characters and rejects the
// WHOLE request with a 400 when one exceeds it. Each mapping (charter, reflections,
// check-ins, harvest) used to emit one unbounded element, so a long reflection, charter
// field or harvest note failed to save — and offline it was worse: `flushQueue` stops at
// the first failure and keeps the item, so one over-long write blocked the queue behind it.
//
// Splitting into 2000-character elements fixes that. Notion allows up to 100 elements per
// property, i.e. 200,000 characters — far beyond anything typed into one field here. The
// value is trimmed first, and an empty/whitespace-only value is `[]`, which is how Notion
// clears a rich-text property. Kept inside this directory: Sol Odyssey is self-contained.

export const RICH_TEXT_LIMIT = 2000

export interface RichTextChunk {
  text: { content: string }
}

/** Trims `value` and splits it into Notion rich-text elements of at most `limit` characters. */
export function toRichTextChunks(value: string, limit = RICH_TEXT_LIMIT): RichTextChunk[] {
  const v = value.trim()
  const chunks: RichTextChunk[] = []
  for (let i = 0; i < v.length; i += limit) {
    chunks.push({ text: { content: v.slice(i, i + limit) } })
  }
  return chunks
}

/** A `rich_text` property payload. */
export function richText(value: string): { rich_text: RichTextChunk[] } {
  return { rich_text: toRichTextChunks(value) }
}
