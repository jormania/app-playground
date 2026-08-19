import { describe, it, expect } from 'vitest'
import { toRichTextChunks, richText, title, RICH_TEXT_LIMIT } from './richText'
import { toNotionThingProps } from './notion'
import { toNotionPathProps } from './paths'
import { toNotionLocusProps } from './loci'
import { toNotionSourceProps } from './sources'

function joined(chunks: { text: { content: string } }[]): string {
  return chunks.map((c) => c.text.content).join('')
}

describe('toRichTextChunks', () => {
  it('is an empty array for nothing, which is how Notion clears a property', () => {
    expect(toRichTextChunks('')).toEqual([])
    expect(toRichTextChunks(null)).toEqual([])
    expect(toRichTextChunks(undefined)).toEqual([])
  })

  it('leaves anything under the limit as a single element', () => {
    expect(toRichTextChunks('A short passage.')).toEqual([{ text: { content: 'A short passage.' } }])
  })

  // The bug this file exists for: Notion rejects the whole request with a 400
  // when one rich-text element exceeds 2000 characters, and Silva is the app
  // in this repo whose entire purpose is keeping long passages.
  it('splits past the limit rather than emitting one oversized element', () => {
    const long = 'x'.repeat(RICH_TEXT_LIMIT * 2 + 250)
    const chunks = toRichTextChunks(long)

    expect(chunks).toHaveLength(3)
    for (const chunk of chunks) {
      expect(chunk.text.content.length).toBeLessThanOrEqual(RICH_TEXT_LIMIT)
    }
    // Nothing is dropped or reordered in the process.
    expect(joined(chunks)).toBe(long)
  })

  it('splits exactly at the boundary without an empty trailing element', () => {
    const exact = 'y'.repeat(RICH_TEXT_LIMIT)
    expect(toRichTextChunks(exact)).toHaveLength(1)
    expect(toRichTextChunks('y'.repeat(RICH_TEXT_LIMIT + 1))).toHaveLength(2)
  })

  it('preserves multi-byte characters across a split', () => {
    const long = '—'.repeat(RICH_TEXT_LIMIT + 10)
    expect(joined(toRichTextChunks(long))).toBe(long)
  })
})

describe('richText / title payloads', () => {
  it('wraps chunks in the property shape Notion expects', () => {
    expect(richText('hello')).toEqual({ rich_text: [{ text: { content: 'hello' } }] })
    expect(title('hello')).toEqual({ title: [{ text: { content: 'hello' } }] })
  })
})

// Every mapping used to carry its own unbounded copy of `richText`. These
// assert the shared, chunking one actually reaches all four.
describe('all four mappings chunk their long fields', () => {
  const long = 'z'.repeat(RICH_TEXT_LIMIT + 500)

  it('a Thing\'s body and note', () => {
    const props = toNotionThingProps({ body: long, note: long })
    expect(props.Body.rich_text.length).toBe(2)
    expect(props.Note.rich_text.length).toBe(2)
    expect(joined(props.Body.rich_text)).toBe(long)
  })

  it('a Path\'s why — the field SILVA.md calls the point of the record', () => {
    const props = toNotionPathProps({ why: long })
    expect(props.Why.rich_text.length).toBe(2)
    expect(joined(props.Why.rich_text)).toBe(long)
  })

  it('a Locus\'s meaning', () => {
    const props = toNotionLocusProps({ meaning: long })
    expect(props.Meaning.rich_text.length).toBe(2)
  })

  it('a Source\'s notes', () => {
    const props = toNotionSourceProps({ notes: long })
    expect(props.Notes.rich_text.length).toBe(2)
  })
})
