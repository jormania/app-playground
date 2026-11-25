import { describe, it, expect } from 'vitest'
import { RICH_TEXT_LIMIT, richText, toRichTextChunks } from './richText'
import { buildReflectionProperties, EMPTY_REFLECTION } from './reflections'
import { buildHarvestProperties } from './harvest'

describe('toRichTextChunks', () => {
  it('splits a 4500-character value into three elements of at most 2000 characters', () => {
    const value = 'a'.repeat(2000) + 'b'.repeat(2000) + 'c'.repeat(500)
    const chunks = toRichTextChunks(value)
    expect(chunks.map((c) => c.text.content.length)).toEqual([2000, 2000, 500])
    expect(chunks.map((c) => c.text.content).join('')).toBe(value)
    expect(chunks[1].text.content).toBe('b'.repeat(2000))
  })

  it('writes [] for empty and whitespace-only values, as before', () => {
    expect(toRichTextChunks('')).toEqual([])
    expect(toRichTextChunks('   \n\t ')).toEqual([])
    expect(richText('  ')).toEqual({ rich_text: [] })
  })

  it('keeps trimming, and a short value is still one element', () => {
    expect(richText('  one line  ')).toEqual({ rich_text: [{ text: { content: 'one line' } }] })
  })

  it('trims before measuring, so exactly the limit after trimming is one element', () => {
    const chunks = toRichTextChunks(`  ${'x'.repeat(RICH_TEXT_LIMIT)}  `)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.content).toHaveLength(RICH_TEXT_LIMIT)
  })
})

describe('the mappings use it', () => {
  it('a long weekly reflection is written as several elements, none over the limit', () => {
    const long = 'w'.repeat(4500)
    const props = buildReflectionProperties(
      'o1',
      { ...EMPTY_REFLECTION, breakPoints: long },
      2,
      '2026-11-25',
      1,
    ) as Record<string, { rich_text: { text: { content: string } }[] }>
    const elements = props['Break Points'].rich_text
    expect(elements).toHaveLength(3)
    expect(elements.every((e) => e.text.content.length <= RICH_TEXT_LIMIT)).toBe(true)
  })

  it('a long harvest note is chunked too', () => {
    const props = buildHarvestProperties('Keep', 'n'.repeat(2001)) as Record<
      string,
      { rich_text: unknown[] }
    >
    expect(props.Notes.rich_text).toHaveLength(2)
  })
})
