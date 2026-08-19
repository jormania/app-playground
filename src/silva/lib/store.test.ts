import { describe, it, expect, vi, afterEach } from 'vitest'
import { SilvaStore } from './store'

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
