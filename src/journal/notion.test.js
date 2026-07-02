import { test, expect, describe } from 'vitest'
import {
  richTextToPlain, plainToRichText, wordCount, toEntry, toNotionProps,
  collectOptions, parseNotionId, RICH_TEXT_LIMIT,
} from './notion.js'

describe('richTextToPlain', () => {
  test('joins multiple rich_text objects', () => {
    expect(richTextToPlain([{ plain_text: 'foam ' }, { plain_text: 'on top' }])).toBe('foam on top')
  })
  test('falls back to text.content when plain_text absent', () => {
    expect(richTextToPlain([{ text: { content: 'hi' } }])).toBe('hi')
  })
  test('non-array is empty string', () => {
    expect(richTextToPlain(undefined)).toBe('')
    expect(richTextToPlain(null)).toBe('')
  })
})

describe('plainToRichText (the 2000-char chunking gotcha)', () => {
  test('empty string clears the property', () => {
    expect(plainToRichText('')).toEqual([])
    expect(plainToRichText(null)).toEqual([])
  })
  test('short text is a single object', () => {
    expect(plainToRichText('the espresso foam')).toEqual([{ text: { content: 'the espresso foam' } }])
  })
  test('text over the limit splits into multiple objects, none too long', () => {
    const long = 'a'.repeat(RICH_TEXT_LIMIT * 2 + 5)
    const chunks = plainToRichText(long)
    expect(chunks).toHaveLength(3)
    expect(chunks.every(c => c.text.content.length <= RICH_TEXT_LIMIT)).toBe(true)
  })
  test('round-trips exactly through richTextToPlain', () => {
    const long = 'word '.repeat(700) // ~3500 chars, a long essayette
    expect(richTextToPlain(plainToRichText(long))).toBe(long)
  })
})

describe('wordCount', () => {
  test('counts whitespace-separated words', () => {
    expect(wordCount('the espresso foam held a moment')).toBe(6)
  })
  test('empty and whitespace are zero (not 1 like the raw formula)', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   \n  ')).toBe(0)
    expect(wordCount(null)).toBe(0)
  })
  test('collapses runs of whitespace and newlines', () => {
    expect(wordCount('one   two\n\nthree')).toBe(3)
  })
})

describe('toEntry', () => {
  const page = {
    id: 'abc',
    properties: {
      Title: { title: [{ plain_text: 'the espresso foam' }] },
      Date: { date: { start: '2026-06-24' } },
      Tags: { multi_select: [{ name: 'light' }, { name: 'morning' }] },
      People: { multi_select: [{ name: 'Mara' }] },
      Entry: { rich_text: [{ plain_text: 'It held its shape a beat too long.' }] },
      'Word Count': { formula: { number: 8 } },
    },
  }
  test('maps every field', () => {
    expect(toEntry(page)).toEqual({
      id: 'abc',
      title: 'the espresso foam',
      date: '2026-06-24',
      tags: ['light', 'morning'],
      people: ['Mara'],
      entry: 'It held its shape a beat too long.',
      wordCount: 8,
      photo: null,
    })
  })
  test('survives missing/empty properties', () => {
    const e = toEntry({ id: 'x', properties: {} })
    expect(e).toEqual({ id: 'x', title: '', date: null, tags: [], people: [], entry: '', wordCount: null, photo: null })
  })
  test('accepts a Name title property as a fallback', () => {
    const e = toEntry({ id: 'y', properties: { Name: { title: [{ plain_text: 'untitled' }] } } })
    expect(e.title).toBe('untitled')
  })
})

describe('toEntry Photo mapping', () => {
  test('maps a Notion-hosted file to { url, name }', () => {
    const page = { id: 'p', properties: { Photo: { files: [{ name: 'delight-2026-06-24.jpg', type: 'file', file: { url: 'https://s3.example/x.jpg', expiry_time: '2026-06-24T12:00:00Z' } }] } } }
    expect(toEntry(page).photo).toEqual({ url: 'https://s3.example/x.jpg', name: 'delight-2026-06-24.jpg' })
  })
  test('an empty files array is no photo', () => {
    const page = { id: 'p', properties: { Photo: { files: [] } } }
    expect(toEntry(page).photo).toBeNull()
  })
  test('only ever reads the first file — the app enforces at most one', () => {
    const page = { id: 'p', properties: { Photo: { files: [
      { name: 'a.jpg', file: { url: 'https://s3.example/a.jpg' } },
      { name: 'b.jpg', file: { url: 'https://s3.example/b.jpg' } },
    ] } } }
    expect(toEntry(page).photo.name).toBe('a.jpg')
  })
})

describe('toNotionProps', () => {
  const entry = {
    title: 'the espresso foam', date: '2026-06-24',
    tags: ['light'], people: ['Mara'], entry: 'short note',
  }
  test('builds the property payload', () => {
    expect(toNotionProps(entry)).toEqual({
      Title: { title: [{ text: { content: 'the espresso foam' } }] },
      Date: { date: { start: '2026-06-24' } },
      Tags: { multi_select: [{ name: 'light' }] },
      People: { multi_select: [{ name: 'Mara' }] },
      Entry: { rich_text: [{ text: { content: 'short note' } }] },
    })
  })
  test('never emits a Word Count property (it is a read-only formula)', () => {
    expect(toNotionProps(entry)).not.toHaveProperty('Word Count')
  })
  test('missing date becomes null, not an invalid empty object', () => {
    expect(toNotionProps({ ...entry, date: null }).Date).toEqual({ date: null })
  })
})

describe('parseNotionId (so users can paste a URL, id, or UUID)', () => {
  const id = 'cf04e03098294448a206d9a4e66f7187'
  test('extracts the id from a full Notion URL with a view query', () => {
    expect(parseNotionId(`https://www.notion.so/me/Journal-of-Delights-${id}?v=abc123`)).toBe(id)
  })
  test('accepts a bare 32-char id', () => {
    expect(parseNotionId(id)).toBe(id)
  })
  test('accepts a dashed UUID and compacts it', () => {
    expect(parseNotionId('cf04e030-9829-4448-a206-d9a4e66f7187')).toBe(id)
  })
  test('a slug ending in hex letters does not bleed into the id', () => {
    // regression: "…App-Spec-<id>" must not glue the "ec" of "Spec" onto the id
    expect(parseNotionId('https://app.notion.com/p/Journal-of-Delights-App-Spec-388d3e6d60db8101addccc18fd955a5f'))
      .toBe('388d3e6d60db8101addccc18fd955a5f')
  })
  test('empty / junk returns empty string', () => {
    expect(parseNotionId('')).toBe('')
    expect(parseNotionId(null)).toBe('')
    expect(parseNotionId('not an id')).toBe('')
  })
})

describe('collectOptions', () => {
  const entries = [
    { tags: ['light', 'morning'], people: ['Mara'] },
    { tags: ['morning', 'rain'], people: ['Mara', 'Sol'] },
  ]
  test('unique, order-preserving tag values', () => {
    expect(collectOptions(entries, 'tags')).toEqual(['light', 'morning', 'rain'])
  })
  test('works for people too', () => {
    expect(collectOptions(entries, 'people')).toEqual(['Mara', 'Sol'])
  })
})
