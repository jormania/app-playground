// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Same in-memory idb-keyval stand-in as vectorCache.test.ts — happy-dom has
// no real IndexedDB, and these tests are about the caching policy, not
// IndexedDB itself.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
  del: async (k: string) => { store.delete(k) },
  keys: async () => [...store.keys()],
}))

const { getLinkPreview, pruneLinkPreviews } = await import('./linkPreviewCache.ts')

function fakePreview(over: Partial<Awaited<ReturnType<typeof getLinkPreview>>> = {}) {
  return { title: 'A Title', description: 'A description', image: 'https://example.com/og.png', siteName: 'example.com', url: 'https://example.com/page', ...over }
}

beforeEach(() => {
  store.clear()
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getLinkPreview', () => {
  it('fetches through the proxy and returns the preview', async () => {
    const preview = fakePreview()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => preview })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getLinkPreview('https://example.com/page')
    expect(result).toEqual(preview)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notion-photo-proxy?mode=link-preview&url=' + encodeURIComponent('https://example.com/page'),
    )
  })

  it('caches the result — a second call for the same URL never hits the network again', async () => {
    const preview = fakePreview()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => preview })
    vi.stubGlobal('fetch', fetchMock)

    await getLinkPreview('https://example.com/page')
    await getLinkPreview('https://example.com/page')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-fetches once the cached preview is past its TTL', async () => {
    const preview = fakePreview()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => preview })
    vi.stubGlobal('fetch', fetchMock)

    vi.useFakeTimers().setSystemTime(new Date('2026-01-01'))
    await getLinkPreview('https://example.com/page')
    vi.setSystemTime(new Date('2026-03-01')) // well past 30 days
    await getLinkPreview('https://example.com/page')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('returns null, without caching, when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await getLinkPreview('https://example.com/broken')).toBeNull()
    expect(store.size).toBe(0)
  })

  it('returns null when the network throws, rather than surfacing an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getLinkPreview('https://example.com/page')).toBeNull()
  })

  it('keeps different URLs independent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => fakePreview({ title: 'A' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => fakePreview({ title: 'B' }) })
    vi.stubGlobal('fetch', fetchMock)

    const a = await getLinkPreview('https://a.example.com')
    const b = await getLinkPreview('https://b.example.com')
    expect(a?.title).toBe('A')
    expect(b?.title).toBe('B')
  })
})

describe('pruneLinkPreviews', () => {
  it('removes cached previews for links no longer on any live thing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakePreview() })
    vi.stubGlobal('fetch', fetchMock)

    await getLinkPreview('https://kept.example.com')
    await getLinkPreview('https://gone.example.com')

    const removed = await pruneLinkPreviews(['https://kept.example.com'])
    expect(removed).toBe(1)

    // Kept link's cache survives — no re-fetch needed for it.
    await getLinkPreview('https://kept.example.com')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
