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

const { getVector, setVector, pruneVectors } = await import('./vectorCache.ts')

beforeEach(() => {
  store.clear()
})

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
