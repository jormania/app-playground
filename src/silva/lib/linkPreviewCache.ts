/**
 * Open Graph previews for a Link thing's `link`, cached on the device —
 * same "one cached blob per key, pruned when unused" shape as
 * `vectorCache.ts`, keyed by URL rather than thing id since the preview is a
 * property of the page, not of any one thing that happens to point at it.
 *
 * Fetched through `/api/notion-photo-proxy?mode=link-preview` (see that
 * file's header for why link previews live in a Notion-named proxy — the
 * repo's serverless-function budget was already full). A page's title,
 * description and social image change rarely enough that a month-long TTL
 * trades a little staleness for not re-fetching the same link every time its
 * plate renders.
 *
 * ── Why this is paced, like every other network path in the app ──────────
 * The Forest renders every kept thing at once, so a forest holding thirty
 * Link things mounts thirty of these at the same instant. Unpaced, that is
 * thirty parallel requests into a relay that allows twenty per ten seconds
 * (`api/_shared.js`) — most come back 429, a failed preview isn't cached, and
 * so it re-fails identically on every subsequent load. Not a transient
 * glitch: a permanently preview-less forest.
 *
 * That is precisely the bug `lib/requestQueue.ts` was written for, so this
 * reuses it rather than inventing a second pacing scheme. A smaller burst
 * than Notion's, since previews are cosmetic and must never be what delays a
 * real write.
 */
import { get, set, del, keys } from 'idb-keyval'
import { createRequestQueue } from './requestQueue'

const PREFIX = 'silva:linkpreview:'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

const previewQueue = createRequestQueue({ burstCapacity: 6, refillIntervalMs: 700 })

/** URLs currently being fetched, so the same link on several things — or the
 *  same plate re-mounting mid-flight — costs exactly one request. */
const inFlight = new Map<string, Promise<LinkPreview | null>>()

export interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  siteName: string
  url: string
}

interface CachedPreview {
  preview: LinkPreview
  fetchedAt: number
}

const cacheKey = (url: string) => `${PREFIX}${url}`

/** The cached preview for a URL, or the freshly fetched one if there's
 *  nothing cached (or it's past `TTL_MS`) — never throws, since a link with
 *  no preview is just a link, exactly as it was before this existed. */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const cached = await get<CachedPreview>(cacheKey(url))
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.preview
  } catch {
    // Falls through to a live fetch.
  }

  const already = inFlight.get(url)
  if (already) return already

  const pending = fetchPreview(url).finally(() => inFlight.delete(url))
  inFlight.set(url, pending)
  return pending
}

async function fetchPreview(url: string): Promise<LinkPreview | null> {
  try {
    const preview = await previewQueue(async () => {
      const res = await fetch(`/api/notion-photo-proxy?mode=link-preview&url=${encodeURIComponent(url)}`)
      // Thrown rather than returned so the queue can recognise a 429 or a
      // transient 5xx and try again — returning null here is what made a
      // rate-limited preview fail permanently.
      if (!res.ok) throw { status: res.status }
      return (await res.json()) as LinkPreview
    })
    try {
      await set(cacheKey(url), { preview, fetchedAt: Date.now() } satisfies CachedPreview)
    } catch {
      // A full or unavailable IndexedDB just means this link re-fetches
      // next time — the preview itself is still shown this time.
    }
    return preview
  } catch {
    // Offline, blocked, or out of retries. A link with no preview is just a
    // link, exactly as it was before this existed.
    return null
  }
}

/** Removes cached previews for links no longer on any live thing — cheap
 *  housekeeping, same pattern as `vectorCache.ts`'s `pruneVectors`. */
export async function pruneLinkPreviews(liveUrls: Iterable<string>): Promise<number> {
  const live = new Set(liveUrls)
  let removed = 0
  try {
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) continue
      const url = key.slice(PREFIX.length)
      if (!live.has(url)) {
        await del(key)
        removed++
      }
    }
  } catch {
    // Best-effort housekeeping — never worth surfacing.
  }
  return removed
}
