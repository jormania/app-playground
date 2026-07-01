import { test, expect, describe, vi, beforeEach } from 'vitest'
import { createNotionClient, DEFAULT_DATABASE_ID, PROXY_URL } from './notionClient.js'

// We inject a fake `fetchImpl` matching the proxy(token, path, method, body)
// signature, so we assert exactly what the client asks the proxy to do.
function makeClient(handler) {
  const calls = []
  const fetchImpl = vi.fn((token, path, method, body) => {
    calls.push({ token, path, method, body })
    return Promise.resolve(handler(path, method, body))
  })
  return { client: createNotionClient('secret-token', { fetchImpl }), calls, fetchImpl }
}

const pageFor = (id, title, date) => ({
  id,
  properties: {
    Title: { title: [{ plain_text: title }] },
    Date: { date: { start: date } },
    Tags: { multi_select: [] },
    People: { multi_select: [] },
    Entry: { rich_text: [{ plain_text: 'note' }] },
    'Word Count': { formula: { number: 1 } },
  },
})

describe('listEntries', () => {
  test('queries the data source, sorted by Date descending, and maps results', async () => {
    const { client, calls } = makeClient((path, method, body) => {
      expect(path).toBe(`databases/${DEFAULT_DATABASE_ID}/query`)
      expect(method).toBe('POST')
      expect(body.sorts).toEqual([{ property: 'Date', direction: 'descending' }])
      return { results: [pageFor('a', 'one', '2026-06-24')], has_more: false }
    })
    const entries = await client.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 'a', title: 'one', date: '2026-06-24' })
    expect(calls[0].token).toBe('secret-token')
  })

  test('follows pagination via has_more / next_cursor', async () => {
    let nth = 0
    const { client } = makeClient((path, method, body) => {
      nth += 1
      if (nth === 1) {
        expect(body.start_cursor).toBeUndefined()
        return { results: [pageFor('a', 'one', '2026-06-24')], has_more: true, next_cursor: 'CUR' }
      }
      expect(body.start_cursor).toBe('CUR')
      return { results: [pageFor('b', 'two', '2026-06-23')], has_more: false }
    })
    const entries = await client.listEntries()
    expect(entries.map(e => e.id)).toEqual(['a', 'b'])
  })
})

describe('createEntry', () => {
  test('POSTs a page parented to the database with mapped props', async () => {
    const { client } = makeClient((path, method, body) => {
      expect(path).toBe('pages')
      expect(method).toBe('POST')
      expect(body.parent).toEqual({ database_id: DEFAULT_DATABASE_ID })
      expect(body.properties.Title.title[0].text.content).toBe('new delight')
      expect(body.properties).not.toHaveProperty('Word Count')
      return pageFor('new', 'new delight', '2026-06-24')
    })
    const saved = await client.createEntry({ title: 'new delight', date: '2026-06-24', tags: [], people: [], entry: 'x' })
    expect(saved.id).toBe('new')
  })

  test('honours a custom databaseId so any user can point at their own copy', async () => {
    const fetchImpl = vi.fn((_token, _path) => Promise.resolve({ results: [], has_more: false }))
    const client = createNotionClient('t', { databaseId: 'mydb', fetchImpl })
    await client.listEntries()
    expect(fetchImpl).toHaveBeenCalledWith('t', 'databases/mydb/query', 'POST', expect.any(Object))
  })
})

describe('updateEntry', () => {
  test('PATCHes the page by id with properties only', async () => {
    const { client } = makeClient((path, method, body) => {
      expect(path).toBe('pages/abc')
      expect(method).toBe('PATCH')
      expect(body).toEqual({ properties: expect.any(Object) })
      return pageFor('abc', 'edited', '2026-06-24')
    })
    const saved = await client.updateEntry('abc', { title: 'edited', date: '2026-06-24', tags: [], people: [], entry: 'x' })
    expect(saved.title).toBe('edited')
  })
})

describe('error handling', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  test('a failed proxy response rejects with the Notion message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ message: 'API token is invalid.' }),
    })
    const client = createNotionClient('bad') // real proxy path, mocked fetch
    await expect(client.listEntries()).rejects.toThrow('API token is invalid.')
    expect(globalThis.fetch).toHaveBeenCalledWith(PROXY_URL, expect.objectContaining({ method: 'POST' }))
  })
})
