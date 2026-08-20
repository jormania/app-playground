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
 */
import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'silva:linkpreview:'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

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

  try {
    const res = await fetch(`/api/notion-photo-proxy?mode=link-preview&url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const preview = (await res.json()) as LinkPreview
    try {
      await set(cacheKey(url), { preview, fetchedAt: Date.now() } satisfies CachedPreview)
    } catch {
      // A full or unavailable IndexedDB just means this link re-fetches
      // next time — the preview itself is still shown this time.
    }
    return preview
  } catch {
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
