// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// The same in-memory idb-keyval stand-in photoStore.test.ts and
// vectorCache.test.ts use — these tests are about the queue's policy, not
// about IndexedDB.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
  del: async (k: string) => { store.delete(k) },
  keys: async () => [...store.keys()],
}))

const { queueCapture, queuedCaptures, forgetCapture, looksOffline } = await import('./outbox.ts')

beforeEach(() => {
  store.clear()
})

function capture(over: Partial<Parameters<typeof queueCapture>[0]> = {}) {
  return {
    id: 'silva-draft-1',
    body: 'https://x.dev/essay',
    locator: '',
    sourceInput: '',
    link: 'https://x.dev/essay',
    kind: 'Link' as const,
    encountered: '2026-09-03',
    queuedAt: 1,
    ...over,
  }
}

describe('looksOffline', () => {
  // The test is the absence of a status: Notion answering, even with a
  // refusal, is not something waiting will fix.
  it('is true only when nothing answered at all', () => {
    expect(looksOffline(new TypeError('Failed to fetch'))).toBe(true)
    expect(looksOffline(undefined)).toBe(true)
    expect(looksOffline(null)).toBe(true)
  })

  it("is false for anything carrying a status, including the store's own 0", () => {
    expect(looksOffline({ status: 400 })).toBe(false)
    expect(looksOffline({ status: 429 })).toBe(false)
    expect(looksOffline({ status: 503 })).toBe(false)
    // "No Things database configured" — a capture queued behind that would
    // wait for a signal that was never the problem.
    expect(looksOffline({ status: 0 })).toBe(false)
  })
})

describe('the queue', () => {
  it('keeps a capture and hands it back', async () => {
    expect(await queueCapture(capture())).toBe(true)
    expect(await queuedCaptures()).toEqual([capture()])
  })

  it('drains oldest first, whatever order it was written in', async () => {
    await queueCapture(capture({ id: 'b', queuedAt: 200 }))
    await queueCapture(capture({ id: 'a', queuedAt: 100 }))
    await queueCapture(capture({ id: 'c', queuedAt: 300 }))
    expect((await queuedCaptures()).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('forgets one without touching the rest', async () => {
    await queueCapture(capture({ id: 'a', queuedAt: 1 }))
    await queueCapture(capture({ id: 'b', queuedAt: 2 }))
    await forgetCapture('a')
    expect((await queuedCaptures()).map((c) => c.id)).toEqual(['b'])
  })

  // IndexedDB is origin-wide and this repo hosts many apps on one origin.
  it('ignores keys belonging to anything else', async () => {
    store.set('silva:photo:1', { not: 'a capture' })
    store.set('some-other-app', 'whatever')
    await queueCapture(capture())
    expect((await queuedCaptures()).map((c) => c.id)).toEqual(['silva-draft-1'])
  })

  it('ignores an entry that is not a capture at all', async () => {
    store.set('silva:outbox:junk', { id: 7 })
    expect(await queuedCaptures()).toEqual([])
  })

  // A device with no usable IndexedDB is worse off, but the caller has
  // already said so on screen — it must never throw into a failure handler.
  it('says so rather than throwing when the device will not store it', async () => {
    const broken = new Map()
    broken.set = () => { throw new Error('QuotaExceededError') }
    const original = store.set.bind(store)
    store.set = broken.set as typeof store.set
    try {
      expect(await queueCapture(capture())).toBe(false)
    } finally {
      store.set = original
    }
  })
})
