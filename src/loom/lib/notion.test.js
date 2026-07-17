import { describe, it, expect } from 'vitest'
import {
  toThread, toNotionProps, parseNotionId, richTextToPlain, plainToRichText, RICH_TEXT_LIMIT,
} from './notion.js'

describe('rich text', () => {
  it('joins Notion rich_text into plain', () => {
    expect(richTextToPlain([{ plain_text: 'spin ' }, { plain_text: 'a thread' }])).toBe('spin a thread')
    expect(richTextToPlain(null)).toBe('')
  })

  it('splits long text into <=2000-char chunks and empty into []', () => {
    expect(plainToRichText('')).toEqual([])
    const long = 'x'.repeat(RICH_TEXT_LIMIT + 5)
    const chunks = plainToRichText(long)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text.content).toHaveLength(RICH_TEXT_LIMIT)
  })
})

describe('toThread', () => {
  it('reads a full page', () => {
    const page = {
      id: 'abc',
      properties: {
        Name: { title: [{ plain_text: 'Weave the report' }] },
        Skein: { select: { name: 'Work' } },
        Day: { date: { start: '2026-07-17' } },
        Order: { number: 250 },
        Done: { checkbox: true },
      },
    }
    expect(toThread(page)).toEqual({
      id: 'abc', title: 'Weave the report', skein: 'Work', day: '2026-07-17', order: 250, done: true,
    })
  })

  it('defaults gracefully on a sparse / drifted page', () => {
    expect(toThread({ id: 'x', properties: {} })).toEqual({
      id: 'x', title: '', skein: null, day: null, order: 0, done: false,
    })
  })

  it('keeps only the day part of a datetime start', () => {
    const page = { id: 'y', properties: { Day: { date: { start: '2026-07-17T09:30:00.000+03:00' } } } }
    expect(toThread(page).day).toBe('2026-07-17')
  })
})

describe('toNotionProps', () => {
  it('builds a create/update payload, clearing nulls', () => {
    const props = toNotionProps({ title: 'a', skein: null, day: null, order: 12, done: false })
    expect(props.Name.title[0].text.content).toBe('a')
    expect(props.Skein.select).toBeNull()
    expect(props.Day.date).toBeNull()
    expect(props.Order.number).toBe(12)
    expect(props.Done.checkbox).toBe(false)
  })

  it('round-trips through toThread', () => {
    const original = { id: 'id1', title: 'plant tomatoes', skein: 'Garden', day: '2026-07-20', order: 500, done: false }
    const props = toNotionProps(original)
    // Notion echoes back title/select/etc; simulate the read shape.
    const echoed = {
      id: 'id1',
      properties: {
        Name: { title: props.Name.title.map(c => ({ plain_text: c.text.content })) },
        Skein: props.Skein,
        Day: props.Day,
        Order: props.Order,
        Done: props.Done,
      },
    }
    expect(toThread(echoed)).toEqual(original)
  })
})

describe('parseNotionId', () => {
  it('extracts from a URL, bare id, and dashed uuid', () => {
    expect(parseNotionId('https://notion.so/me/Loom-0123456789abcdef0123456789abcdef?v=1'))
      .toBe('0123456789abcdef0123456789abcdef')
    expect(parseNotionId('0123456789ABCDEF0123456789ABCDEF')).toBe('0123456789abcdef0123456789abcdef')
    expect(parseNotionId('01234567-89ab-cdef-0123-456789abcdef')).toBe('0123456789abcdef0123456789abcdef')
    expect(parseNotionId('')).toBe('')
    expect(parseNotionId('nope')).toBe('')
  })
})
