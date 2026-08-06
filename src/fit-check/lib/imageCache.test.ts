// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// idb-keyval needs a real IndexedDB; happy-dom has none. An in-memory stand-in
// keeps these tests about the caching POLICY — cache-first, one fetch per
// garment, offline behaviour — rather than about IndexedDB itself.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
  del: async (k: string) => { store.delete(k) },
  keys: async () => [...store.keys()],
}))

const { getPhoto, putPhoto, evictPhoto, pruneCache, _resetMemo } = await import('./imageCache.ts')

let created = 0
beforeEach(() => {
  store.clear()
  _resetMemo()
  created = 0
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock-${++created}`)
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(() => { vi.restoreAllMocks() })

const blob = (text = 'jpeg-bytes') => new Blob([text], { type: 'image/jpeg' })

describe('getPhoto', () => {
  it('serves from IndexedDB without touching the network', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as never
    await putPhoto('g1', blob())
    _resetMemo() // force it to go back to the store rather than the memo

    const url = await getPhoto('g1', 'https://signed.example/photo.jpg')
    expect(url).toMatch(/^blob:/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches through the photo proxy on a miss, then caches', async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response(blob(), { status: 200 }))
    globalThis.fetch = fetchSpy as never

    const url = await getPhoto('g2', 'https://signed.example/p.jpg')
    expect(url).toMatch(/^blob:/)

    // The signed URL has no CORS headers, so it must go via the relay.
    const called = fetchSpy.mock.calls[0][0]
    expect(called).toContain('/api/notion-photo-proxy?url=')
    expect(called).toContain(encodeURIComponent('https://signed.example/p.jpg'))

    expect(store.has('fitcheck:photo:g2')).toBe(true)
  })

  it('makes one request when a whole grid asks at once', async () => {
    // A 40-tile grid mounting simultaneously must not fire 40 identical fetches.
    const fetchSpy = vi.fn(async () => new Response(blob(), { status: 200 }))
    globalThis.fetch = fetchSpy as never

    const urls = await Promise.all(
      Array.from({ length: 40 }, () => getPhoto('g3', 'https://signed.example/p.jpg')),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(new Set(urls).size).toBe(1)
  })

  it('returns the same object URL across calls, so a remount is not a re-fetch', async () => {
    globalThis.fetch = vi.fn(async () => new Response(blob(), { status: 200 })) as never
    const first = await getPhoto('g4', 'https://signed.example/p.jpg')
    const second = await getPhoto('g4', 'https://signed.example/p.jpg')
    expect(second).toBe(first)
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('returns null offline with nothing cached, rather than throwing', async () => {
    // The LQIP on the row is what the tile shows in this case — the whole
    // reason the placeholder is stored on the garment.
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') }) as never
    expect(await getPhoto('g5', 'https://signed.example/p.jpg')).toBe(null)
  })

  it('returns null when the garment has no photo at all', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as never
    expect(await getPhoto('g6', null)).toBe(null)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not cache an empty response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(new Blob([]), { status: 200 })) as never
    expect(await getPhoto('g7', 'https://signed.example/p.jpg')).toBe(null)
    expect(store.has('fitcheck:photo:g7')).toBe(false)
  })

  it('does not cache a proxy error', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 403 })) as never
    expect(await getPhoto('g8', 'https://signed.example/p.jpg')).toBe(null)
    expect(store.has('fitcheck:photo:g8')).toBe(false)
  })
})

describe('putPhoto', () => {
  it('caches bytes we already hold, so a new photo needs no round-trip', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as never
    const url = await putPhoto('fresh', blob())
    expect(url).toMatch(/^blob:/)
    expect(await getPhoto('fresh', null)).toBe(url)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('housekeeping', () => {
  it('evictPhoto clears both the store and the memo', async () => {
    await putPhoto('gone', blob())
    await evictPhoto('gone')
    expect(store.has('fitcheck:photo:gone')).toBe(false)
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()
    expect(await getPhoto('gone', null)).toBe(null)
  })

  it('pruneCache drops only garments that no longer exist', async () => {
    await putPhoto('keep', blob())
    await putPhoto('drop', blob())
    const removed = await pruneCache(['keep'])
    expect(removed).toBe(1)
    expect(store.has('fitcheck:photo:keep')).toBe(true)
    expect(store.has('fitcheck:photo:drop')).toBe(false)
  })

  it('pruneCache ignores keys belonging to other apps on the same origin', async () => {
    // Every app in this repo shares one origin, so the cache must never sweep
    // up another app's entries.
    store.set('someOtherApp:thing', 'x')
    await pruneCache([])
    expect(store.has('someOtherApp:thing')).toBe(true)
  })
})
