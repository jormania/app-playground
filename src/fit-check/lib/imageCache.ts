/**
 * Garment photos, cached on the device.
 *
 * The problem this solves: Notion serves uploaded files as short-lived signed
 * S3 URLs. A wardrobe is 50–150 garments rendered as a photo grid on every
 * screen, so leaning on those URLs directly would mean re-querying pages to
 * refresh them, a slow cold start, and nothing at all offline. (WhereItWent
 * stores no images; Journal and Wanderlist store one per entry — this repo has
 * never hit the problem at this scale before.)
 *
 * So a photo is fetched from Notion exactly once, through the EXISTING
 * `api/notion-photo-proxy.js` — those signed URLs send no CORS headers, so a
 * `fetch()` can't read their bytes, but a server-to-server relay has no such
 * restriction. The bytes then live in IndexedDB, keyed by garment id, and every
 * later render reads from there. No signed URL, no network, works offline.
 *
 * No new serverless function: the proxy is generic and already deployed, which
 * matters because the repo sits at Vercel Hobby's 12-function cap.
 */
import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'fitcheck:photo:'
const PROXY = '/api/notion-photo-proxy'

/**
 * Object URLs created from cached blobs, held for the page's lifetime.
 *
 * Deliberately never revoked: the same garment tile is mounted and unmounted
 * constantly as Nora moves between tabs and filters, and revoking on unmount
 * makes an already-loaded photo render as a broken image the moment it comes
 * back. The set is bounded by wardrobe size (~150 URLs, a few bytes each), and
 * the whole map dies with the page.
 */
const objectUrls = new Map<string, string>()

/** In-flight fetches, so a grid mounting 40 tiles at once makes 40 requests, not 400. */
const inflight = new Map<string, Promise<string | null>>()

const cacheKey = (garmentId: string) => `${PREFIX}${garmentId}`

function toObjectUrl(garmentId: string, blob: Blob): string {
  const existing = objectUrls.get(garmentId)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  objectUrls.set(garmentId, url)
  return url
}

/** Store bytes we already hold — called right after upload, so a just-photographed
 *  garment is cached without a round-trip back to Notion. */
export async function putPhoto(garmentId: string, blob: Blob): Promise<string> {
  try {
    await set(cacheKey(garmentId), blob)
  } catch {
    // A full or unavailable IndexedDB shouldn't break adding a garment; the
    // photo just gets re-fetched later.
  }
  return toObjectUrl(garmentId, blob)
}

/**
 * A displayable URL for a garment's photo, or null if there isn't one.
 *
 * Cache first, network only on a miss. `remoteUrl` is Notion's signed URL from
 * the most recent page read — it is used immediately or not at all, never stored.
 */
export async function getPhoto(garmentId: string, remoteUrl: string | null): Promise<string | null> {
  const memo = objectUrls.get(garmentId)
  if (memo) return memo

  const pending = inflight.get(garmentId)
  if (pending) return pending

  const task = (async (): Promise<string | null> => {
    try {
      const cached = await get<Blob>(cacheKey(garmentId))
      if (cached) return toObjectUrl(garmentId, cached)
    } catch {
      // Unreadable cache — fall through and try the network.
    }

    if (!remoteUrl) return null

    try {
      const res = await fetch(`${PROXY}?url=${encodeURIComponent(remoteUrl)}`)
      if (!res.ok) return null
      const blob = await res.blob()
      if (!blob.size) return null
      return await putPhoto(garmentId, blob)
    } catch {
      // Offline with nothing cached. The LQIP placeholder is what Nora sees,
      // which is the whole reason it's stored on the row.
      return null
    }
  })()

  inflight.set(garmentId, task)
  try {
    return await task
  } finally {
    inflight.delete(garmentId)
  }
}

/** Drop one garment's cached bytes — after replacing its photo, or deleting it. */
export async function evictPhoto(garmentId: string): Promise<void> {
  const url = objectUrls.get(garmentId)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(garmentId)
  }
  try { await del(cacheKey(garmentId)) } catch { /* nothing to do */ }
}

/**
 * Remove cached photos for garments that no longer exist. Cheap to run at
 * startup, and without it the cache grows forever as garments are deleted.
 */
export async function pruneCache(liveGarmentIds: Iterable<string>): Promise<number> {
  const live = new Set(liveGarmentIds)
  let removed = 0
  try {
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) continue
      const id = key.slice(PREFIX.length)
      if (!live.has(id)) {
        await evictPhoto(id)
        removed++
      }
    }
  } catch {
    // Best-effort housekeeping — never worth surfacing.
  }
  return removed
}

/** Test seam: forget the in-memory memoisation without touching IndexedDB. */
export function _resetMemo(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
  inflight.clear()
}
