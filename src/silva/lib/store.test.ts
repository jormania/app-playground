import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { SilvaStore, resetDemoThings } from './store'

describe('SilvaStore.testConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fails immediately in demo mode (no token)', async () => {
    const store = new SilvaStore('')
    expect(await store.testConnection()).toEqual({ ok: false, message: 'Enter a Notion token first.' })
  })

  it('fails when no Things database is configured', async () => {
    const store = new SilvaStore('a-token', null)
    expect(await store.testConnection()).toEqual({ ok: false, message: 'No Things database configured.' })
  })

  it('reports ok on a successful read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'db-1' }), { status: 200 })))
    const store = new SilvaStore('a-token')
    const result = await store.testConnection()
    expect(result.ok).toBe(true)
  })

  it('surfaces the relay/Notion error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'API token is invalid.' }), { status: 401 })),
    )
    const store = new SilvaStore('a-bad-token')
    const result = await store.testConnection()
    expect(result).toEqual({ ok: false, message: 'API token is invalid.' })
  })
})

describe('SilvaStore.updateThing — Handle', () => {
  beforeEach(() => resetDemoThings())

  // `Handle` is the Notion row's title, derived from `body` at create time.
  // Never re-deriving it on edit left a changed thing's Notion row titled by
  // its old opening words forever — the one column actually visible in a
  // Notion table view, silently stale.
  it('re-derives the handle whenever the body changes', async () => {
    const store = new SilvaStore('')
    const created = await store.createThing({ body: 'The original opening words.' })
    expect(created.handle).toBe('The original opening words.')

    const updated = await store.updateThing(created.id, { body: 'Something else entirely now.' })
    expect(updated.handle).toBe('Something else entirely now.')
  })

  it('leaves the handle alone when the body is untouched', async () => {
    const store = new SilvaStore('')
    const created = await store.createThing({ body: 'The original opening words.' })
    const updated = await store.updateThing(created.id, { state: 'Kept', kept: '2026-08-20' })
    expect(updated.handle).toBe('The original opening words.')
  })

  it('respects an explicitly supplied handle over the derived one', async () => {
    const store = new SilvaStore('')
    const created = await store.createThing({ body: 'The original opening words.' })
    const updated = await store.updateThing(created.id, { body: 'New body.', handle: 'My own title' })
    expect(updated.handle).toBe('My own title')
  })
})

/**
 * The incremental half of the cached load (lib/collectionCache.ts). A full
 * read costs one sequential round trip per 100 rows, so it grows with
 * everything ever kept; an incremental read costs one round trip for
 * everything changed since yesterday, which is almost always nothing.
 */
describe('SilvaStore — incremental reads', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubQuery() {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  /** The Notion query body the relay was asked to forward. The relay takes
   *  `{ path, method, body }`, so the query itself is one level in. */
  function queryBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const relayPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    return (relayPayload.body ?? {}) as Record<string, unknown>
  }

  it('sends no filter at all without a `since`', async () => {
    const fetchMock = stubQuery()
    await new SilvaStore('a-token').listThings()
    expect(queryBody(fetchMock).filter).toBeUndefined()
  })

  it('filters on last_edited_time when given a `since`', async () => {
    const fetchMock = stubQuery()
    await new SilvaStore('a-token').listThings('2026-08-20T10:00:00.000Z')
    expect(queryBody(fetchMock).filter).toEqual({
      timestamp: 'last_edited_time',
      last_edited_time: { after: '2026-08-20T10:00:00.000Z' },
    })
  })

  it('applies the same filter to every database, not just Things', async () => {
    for (const call of ['listSources', 'listLoci', 'listPaths'] as const) {
      const fetchMock = stubQuery()
      await new SilvaStore('a-token')[call]('2026-08-20T10:00:00.000Z')
      expect(queryBody(fetchMock).filter).toMatchObject({ timestamp: 'last_edited_time' })
      vi.unstubAllGlobals()
    }
  })

  // Demo mode never touches the network, so `since` is simply irrelevant
  // there — it must not start making requests just because one was passed.
  it('ignores `since` in demo mode without any request', async () => {
    const fetchMock = stubQuery()
    await new SilvaStore('').listThings('2026-08-20T10:00:00.000Z')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
