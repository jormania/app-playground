/**
 * Cached embedding vectors, on the device. IndexedDB via `idb-keyval`'s
 * default store, prefixed keys — same shape as Fit Check's
 * `lib/imageCache.ts` (the closer precedent for Silva's "one cached blob
 * per id" need than Sol Odyssey's single-key queue).
 *
 * Keyed by thing id + a content hash (SILVA.md: "so an edit invalidates
 * its own vector and nothing else") — `getVector` returns null on a hash
 * mismatch, which the caller reads as "needs re-embedding," never as an
 * error.
 */
import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'silva:vector:'

interface CachedVector {
  hash: string
  vector: Float32Array
}

const cacheKey = (thingId: string) => `${PREFIX}${thingId}`

/** The cached vector for a thing, or null if there isn't one or it's stale
 *  (its stored hash doesn't match `currentHash`). */
export async function getVector(thingId: string, currentHash: string): Promise<Float32Array | null> {
  try {
    const cached = await get<CachedVector>(cacheKey(thingId))
    if (!cached || cached.hash !== currentHash) return null
    return cached.vector
  } catch {
    return null
  }
}

export async function setVector(thingId: string, hash: string, vector: Float32Array): Promise<void> {
  try {
    await set(cacheKey(thingId), { hash, vector } satisfies CachedVector)
  } catch {
    // A full or unavailable IndexedDB shouldn't break search — the thing is
    // simply re-embedded next time (or search falls back to lexical-only).
  }
}

/** Removes cached vectors for things that no longer exist — cheap
 *  housekeeping, same pattern as imageCache.ts's pruneCache. */
export async function pruneVectors(liveThingIds: Iterable<string>): Promise<number> {
  const live = new Set(liveThingIds)
  let removed = 0
  try {
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) continue
      const id = key.slice(PREFIX.length)
      if (!live.has(id)) {
        await del(key)
        removed++
      }
    }
  } catch {
    // Best-effort housekeeping — never worth surfacing.
  }
  return removed
}
