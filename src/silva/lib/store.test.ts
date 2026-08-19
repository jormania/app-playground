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
