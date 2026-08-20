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

  // The Forest renders every kept thing at once, so the same article kept
  // twice — or one plate re-mounting mid-flight — must not cost two
  // requests against a relay that allows twenty per ten seconds.
  it('collapses concurrent requests for the same URL into one fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakePreview({ title: 'Once' }) })
    vi.stubGlobal('fetch', fetchMock)

    const [a, b, c] = await Promise.all([
      getLinkPreview('https://example.com/same'),
      getLinkPreview('https://example.com/same'),
      getLinkPreview('https://example.com/same'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a?.title).toBe('Once')
    expect(b?.title).toBe('Once')
    expect(c?.title).toBe('Once')
  })

  // The bug this exists for: a rate-limited preview used to return null and
  // go uncached, so it re-failed identically on every later load — a
  // permanently preview-less forest rather than a transient glitch.
  it('retries a rate-limited preview instead of failing it permanently', async () => {
    vi.useFakeTimers()
    let attempts = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 3) return { ok: false, status: 429 }
      return { ok: true, json: async () => fakePreview({ title: 'Landed' }) }
    }))

    const pending = getLinkPreview('https://example.com/rate-limited')
    await vi.runAllTimersAsync()

    expect((await pending)?.title).toBe('Landed')
    expect(attempts).toBe(3)
    vi.useRealTimers()
  })

  // A 404 is the caller's answer, not a transient failure — retrying it only
  // burns the shared budget a real preview needs.
  it('does not retry a link that simply is not there', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getLinkPreview('https://example.com/gone')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
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
