/**
 * Photographs kept on this device.
 *
 * The photo lane has to work in the demo forest, which has no Notion to upload
 * to — and a downscaled page photograph is roughly 200–400 KB. Held as a data
 * URL inside the demo snapshot, a handful of them would blow through
 * localStorage's ~5 MB and take the whole demo forest down with them, since
 * that snapshot is written as one blob.
 *
 * So demo photos live in IndexedDB as Blobs, and `Thing.image` holds a
 * reference (`LOCAL_IMAGE_PREFIX` + id) rather than the bytes. localStorage
 * carries a short string; IndexedDB carries the megabytes, which is what each
 * is actually for. Live things are unaffected: their `image` is a real Notion
 * URL and never touches this module.
 */

import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'silva:photo:'

/** Marks a `Thing.image` as living in this device's IndexedDB rather than
 *  being a fetchable URL. Deliberately not a real scheme — nothing must ever
 *  try to load it directly. */
export const LOCAL_IMAGE_PREFIX = 'silva-local:'

export function isLocalImage(image: string | null | undefined): boolean {
  return typeof image === 'string' && image.startsWith(LOCAL_IMAGE_PREFIX)
}

export function localImageRef(id: string): string {
  return `${LOCAL_IMAGE_PREFIX}${id}`
}

function keyFor(ref: string): string {
  return `${PREFIX}${ref.slice(LOCAL_IMAGE_PREFIX.length)}`
}

export async function putLocalPhoto(id: string, blob: Blob): Promise<string> {
  const ref = localImageRef(id)
  await set(keyFor(ref), blob)
  return ref
}

/**
 * An object URL for a locally-stored photo, or null if it isn't there.
 *
 * The caller owns the returned URL and **must** revoke it when done — an
 * object URL pins its blob in memory for the lifetime of the document
 * otherwise, and the Forest can hold a great many plates.
 */
export async function localPhotoUrl(ref: string): Promise<string | null> {
  if (!isLocalImage(ref)) return null
  try {
    const blob = await get<Blob>(keyFor(ref))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

export async function deleteLocalPhoto(ref: string): Promise<void> {
  if (!isLocalImage(ref)) return
  try {
    await del(keyFor(ref))
  } catch {
    // Worst case the bytes linger; never worth surfacing.
  }
}

/**
 * Drops photo blobs no live thing points at any more — the same
 * housekeeping `vectorCache.ts` and `linkPreviewCache.ts` do for their own
 * caches, and by far the most expensive of the three to skip: a vector is
 * ~1.5 KB and a preview a few hundred bytes, but a downscaled page
 * photograph is 200–400 KB.
 *
 * It was skipped. `deleteLocalPhoto` above shipped written and never
 * called from anywhere, and "Reset the demo forest" (store.ts's
 * `resetDemoThings`) clears localStorage and the in-memory arrays while
 * leaving every blob behind — so photographing pages in the demo grew
 * IndexedDB by megabytes that nothing could ever reclaim.
 */
export async function pruneLocalPhotos(liveImageRefs: Iterable<string | null>): Promise<number> {
  const live = new Set<string>()
  for (const ref of liveImageRefs) {
    if (isLocalImage(ref)) live.add(keyFor(ref as string))
  }

  let removed = 0
  try {
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) continue
      if (live.has(key)) continue
      await del(key)
      removed++
    }
  } catch {
    // Best-effort housekeeping — never worth surfacing.
  }
  return removed
}
