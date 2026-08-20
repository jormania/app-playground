// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// idb-keyval needs a real IndexedDB; happy-dom has none. Same in-memory
// stand-in as fit-check/lib/imageCache.test.ts — these tests are about the
// caching policy (hash-based staleness, prefix scoping), not IndexedDB itself.
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
  del: async (k: string) => { store.delete(k) },
  keys: async () => [...store.keys()],
}))

const { getVector, setVector, pruneVectors, peekVectors } = await import('./vectorCache.ts')
const { contentHash } = await import('./embeddings.ts')

beforeEach(() => {
  store.clear()
})

function fakeThing(id: string, body: string) {
  return {
    id, handle: body, body, kind: null, state: 'Kept' as const, sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null,
  }
}

describe('getVector / setVector', () => {
  it('returns null for a thing never cached', async () => {
    expect(await getVector('thing-1', 'hash-a')).toBeNull()
  })

  it('returns the cached vector when the hash matches', async () => {
    const vector = new Float32Array([1, 2, 3])
    await setVector('thing-1', 'hash-a', vector)
    expect(await getVector('thing-1', 'hash-a')).toEqual(vector)
  })

  it('returns null when the hash no longer matches — a stale vector, not a cache hit', async () => {
    await setVector('thing-1', 'hash-a', new Float32Array([1, 2, 3]))
    expect(await getVector('thing-1', 'hash-b')).toBeNull()
  })

  it('keeps different things independent', async () => {
    await setVector('thing-1', 'hash-a', new Float32Array([1]))
    await setVector('thing-2', 'hash-a', new Float32Array([2]))
    expect(await getVector('thing-1', 'hash-a')).toEqual(new Float32Array([1]))
    expect(await getVector('thing-2', 'hash-a')).toEqual(new Float32Array([2]))
  })
})

describe('peekVectors', () => {
  it('returns cached vectors keyed by thing id, skipping anything uncached', async () => {
    const a = fakeThing('a', 'Body A')
    const b = fakeThing('b', 'Body B')
    await setVector('a', contentHash(a.body), new Float32Array([1]))
    // b is never cached.
    const result = await peekVectors([a, b])
    expect(result.size).toBe(1)
    expect(result.get('a')).toEqual(new Float32Array([1]))
    expect(result.has('b')).toBe(false)
  })

  it('skips a stale cache entry (hash no longer matches the thing\'s current body)', async () => {
    const a = fakeThing('a', 'Original body')
    await setVector('a', contentHash('A different body entirely'), new Float32Array([1]))
    const result = await peekVectors([a])
    expect(result.has('a')).toBe(false)
  })

  it('returns an empty map for an empty list, without error', async () => {
    expect((await peekVectors([])).size).toBe(0)
  })
})

describe('pruneVectors', () => {
  it('removes vectors for things no longer live, leaves the rest', async () => {
    await setVector('thing-1', 'hash-a', new Float32Array([1]))
    await setVector('thing-2', 'hash-a', new Float32Array([2]))
    const removed = await pruneVectors(['thing-1'])
    expect(removed).toBe(1)
    expect(await getVector('thing-1', 'hash-a')).toEqual(new Float32Array([1]))
    expect(await getVector('thing-2', 'hash-a')).toBeNull()
  })

  it('never touches keys outside its own prefix', async () => {
    store.set('someOtherApp:key', 'untouched')
    await pruneVectors([])
    expect(store.get('someOtherApp:key')).toBe('untouched')
  })
})
