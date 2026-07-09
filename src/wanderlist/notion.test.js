import { test, expect, describe } from 'vitest'
import {
  richTextToPlain, plainToRichText, toEntry, toNotionProps,
  collectOptions, parseNotionId, ticketWriteEntry, RICH_TEXT_LIMIT,
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
      category: 'event',
      place: 'Cinema Pro',
      placeUrl: 'https://maps.example/pin',
      tags: ['ticketed', 'film'],
      attended: true,
      dateAdded: '2026-07-01',
      dateExpiring: '2026-07-10',
      plannedDate: '2026-07-11',
      plannedTime: null,
      photo: null,
      tickets: [],
    })
  })
  test('splits a Planned Date datetime into plannedDate + plannedTime', () => {
    const e = toEntry({
      id: 'x',
      properties: {
        Name: { title: [{ plain_text: 'x' }] },
        'Planned Date': { date: { start: '2026-07-11T19:30:00.000+03:00' } },
      },
    })
    expect(e.plannedDate).toBe('2026-07-11')
    expect(e.plannedTime).toBe('19:30')
  })
  test('a bare Planned Date (no time) reads plannedTime as null', () => {
    const e = toEntry({
      id: 'x',
      properties: { Name: { title: [{ plain_text: 'x' }] }, 'Planned Date': { date: { start: '2026-07-11' } } },
    })
    expect(e.plannedDate).toBe('2026-07-11')
    expect(e.plannedTime).toBeNull()
  })
  test('normalizes Category and Tags to lowercase on read', () => {
    const e = toEntry({
      id: 'x',
      properties: {
        Name: { title: [{ plain_text: 'x' }] },
        Category: { select: { name: 'CULTURE' } },
        Tags: { multi_select: [{ name: 'Free' }, { name: 'WITH-FRIENDS' }] },
      },
    })
    expect(e.category).toBe('culture')
    expect(e.tags).toEqual(['free', 'with-friends'])
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
    expect(props.Category).toEqual({ select: { name: 'event' } })
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
  test('normalizes Category and Tags to lowercase + deduped on write', () => {
    const props = toNotionProps({ category: 'CULTURE', tags: ['Free', 'free', 'WITH-friends'] })
    expect(props.Category).toEqual({ select: { name: 'culture' } })
    expect(props.Tags).toEqual({ multi_select: [{ name: 'free' }, { name: 'with-friends' }] })
  })
  test('a Planned Date with no time writes a bare date', () => {
    const props = toNotionProps({ plannedDate: '2026-07-11', plannedTime: null })
    expect(props['Planned Date']).toEqual({ date: { start: '2026-07-11' } })
  })
  test('a Planned Date with a time writes a full ISO datetime with this machine’s offset', () => {
    const props = toNotionProps({ plannedDate: '2026-07-11', plannedTime: '19:30' })
    expect(props['Planned Date'].date.start).toMatch(/^2026-07-11T19:30:00[+-]\d{2}:\d{2}$/)
  })
  test('Planned Date + time round-trips through write then read unchanged', () => {
    const written = toNotionProps({ plannedDate: '2026-07-11', plannedTime: '08:05' })['Planned Date']
    const read = toEntry({ id: 'x', properties: { Name: { title: [] }, 'Planned Date': written } })
    expect(read.plannedDate).toBe('2026-07-11')
    expect(read.plannedTime).toBe('08:05')
  })
})

describe('toEntry — Photo / Tickets', () => {
  test('maps a single Photo file, preferring internal file.url over external', () => {
    const e = toEntry({
      id: 'x',
      properties: {
        Name: { title: [{ plain_text: 'x' }] },
        Photo: { files: [{ name: 'poster.jpg', file: { url: 'https://notion.so/poster.jpg' } }] },
      },
    })
    expect(e.photo).toEqual({ url: 'https://notion.so/poster.jpg', name: 'poster.jpg' })
  })
  test('no Photo files -> null; a file with neither url shape -> null', () => {
    expect(toEntry({ id: 'x', properties: { Photo: { files: [] } } }).photo).toBeNull()
    expect(toEntry({ id: 'x', properties: {} }).photo).toBeNull()
  })
  test('maps multiple Tickets files, capturing fileUploadId when present', () => {
    const e = toEntry({
      id: 'x',
      properties: {
        Tickets: {
          files: [
            { name: 'ticket1.pdf', file: { url: 'https://notion.so/t1.pdf' }, file_upload: { id: 'up_1' } },
            { name: 'ticket2.png', external: { url: 'https://elsewhere/t2.png' } }, // no file_upload id
          ],
        },
      },
    })
    expect(e.tickets).toEqual([
      { url: 'https://notion.so/t1.pdf', name: 'ticket1.pdf', fileUploadId: 'up_1' },
      { url: 'https://elsewhere/t2.png', name: 'ticket2.png', fileUploadId: null },
    ])
  })
  test('a ticket with no readable url is dropped', () => {
    const e = toEntry({ id: 'x', properties: { Tickets: { files: [{ name: 'broken' }] } } })
    expect(e.tickets).toEqual([])
  })
})

describe('ticketWriteEntry', () => {
  test('prefers the durable file_upload id when known', () => {
    expect(ticketWriteEntry({ name: 'a.pdf', fileUploadId: 'up_1', url: 'https://stale' }))
      .toEqual({ type: 'file_upload', file_upload: { id: 'up_1' }, name: 'a.pdf' })
  })
  test('falls back to external + the freshest known url when no id is known', () => {
    expect(ticketWriteEntry({ name: 'b.pdf', fileUploadId: null, url: 'https://notion.so/b.pdf' }))
      .toEqual({ type: 'external', name: 'b.pdf', external: { url: 'https://notion.so/b.pdf' } })
  })
  test('defaults a missing name to "ticket"', () => {
    expect(ticketWriteEntry({ fileUploadId: 'up_2' }).name).toBe('ticket')
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
