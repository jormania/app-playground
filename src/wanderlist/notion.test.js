import { test, expect, describe } from 'vitest'
import {
  richTextToPlain, plainToRichText, toEntry, toNotionProps,
  collectOptions, parseNotionId, RICH_TEXT_LIMIT,
} from './notion.js'

describe('richTextToPlain / plainToRichText', () => {
  test('joins and falls back to text.content', () => {
    expect(richTextToPlain([{ plain_text: 'a ' }, { text: { content: 'b' } }])).toBe('a b')
    expect(richTextToPlain(undefined)).toBe('')
  })
  test('chunks long text at the 2000-char cap and rejoins losslessly', () => {
    const long = 'x'.repeat(RICH_TEXT_LIMIT * 2 + 5)
    const chunks = plainToRichText(long)
    expect(chunks).toHaveLength(3)
    expect(chunks.every(c => c.text.content.length <= RICH_TEXT_LIMIT)).toBe(true)
    expect(richTextToPlain(chunks.map(c => ({ plain_text: c.text.content })))).toBe(long)
  })
  test('empty clears the property', () => {
    expect(plainToRichText('')).toEqual([])
  })
})

describe('toEntry', () => {
  const page = {
    id: 'page-1',
    properties: {
      Name: { title: [{ plain_text: 'Anim’est closing' }] },
      Description: { rich_text: [{ plain_text: 'shorts + gala' }] },
      Link: { url: 'https://animest.ro' },
      Category: { select: { name: 'Event' } },
      Place: { rich_text: [{ plain_text: 'Cinema Pro' }] },
      Map: { url: 'https://maps.example/pin' },
      Tags: { multi_select: [{ name: 'ticketed' }, { name: 'film' }] },
      Attended: { checkbox: true },
      'Date Added': { date: { start: '2026-07-01' } },
      'Date Expiring': { date: { start: '2026-07-10' } },
      'Planned Date': { date: { start: '2026-07-11' } },
    },
  }
  test('maps every property into the app model', () => {
    expect(toEntry(page)).toEqual({
      id: 'page-1',
      name: 'Anim’est closing',
      description: 'shorts + gala',
      link: 'https://animest.ro',
      category: 'Event',
      place: 'Cinema Pro',
      placeUrl: 'https://maps.example/pin',
      tags: ['ticketed', 'film'],
      attended: true,
      dateAdded: '2026-07-01',
      dateExpiring: '2026-07-10',
      plannedDate: '2026-07-11',
    })
  })
  test('is defensive about missing / empty properties', () => {
    const e = toEntry({ id: 'x', properties: { Name: { title: [] } } })
    expect(e).toMatchObject({ name: '', category: null, place: '', tags: [], attended: false, dateExpiring: null })
  })
})

describe('toNotionProps', () => {
  test('writes select, multi_select, checkbox, url and dates; nulls clear', () => {
    const props = toNotionProps({
      name: 'Jazz', description: '', link: '', category: 'Event', place: 'Uranus',
      placeUrl: '', tags: ['free', 'outdoor'], attended: false, dateAdded: '2026-07-01',
      dateExpiring: null, plannedDate: null,
    })
    expect(props['Planned Date']).toEqual({ date: null })
    expect(props.Category).toEqual({ select: { name: 'Event' } })
    expect(props.Tags).toEqual({ multi_select: [{ name: 'free' }, { name: 'outdoor' }] })
    expect(props.Attended).toEqual({ checkbox: false })
    expect(props.Link).toEqual({ url: null })
    expect(props.Place).toEqual({ rich_text: [{ text: { content: 'Uranus' } }] })
    expect(props['Date Expiring']).toEqual({ date: null })
    expect(props['Date Added']).toEqual({ date: { start: '2026-07-01' } })
  })
  test('empty category clears the select', () => {
    expect(toNotionProps({ category: null }).Category).toEqual({ select: null })
  })
})

describe('collectOptions', () => {
  const entries = [
    { category: 'Event', tags: ['free', 'outdoor'] },
    { category: 'Art', tags: ['free', 'ticketed'] },
    { category: 'Event', tags: [] },
  ]
  test('unique, order-preserving for arrays and scalars', () => {
    expect(collectOptions(entries, 'tags')).toEqual(['free', 'outdoor', 'ticketed'])
    expect(collectOptions(entries, 'category')).toEqual(['Event', 'Art'])
  })
})

describe('parseNotionId', () => {
  test('extracts a bare id, a URL id, and a dashed uuid', () => {
    expect(parseNotionId('41c42bc4dfb543f49051810b3c5880fe')).toBe('41c42bc4dfb543f49051810b3c5880fe')
    expect(parseNotionId('https://notion.so/me/Findings-41c42bc4dfb543f49051810b3c5880fe?v=1')).toBe('41c42bc4dfb543f49051810b3c5880fe')
    expect(parseNotionId('41c42bc4-dfb5-43f4-9051-810b3c5880fe')).toBe('41c42bc4dfb543f49051810b3c5880fe')
    expect(parseNotionId('nope')).toBe('')
  })
})
