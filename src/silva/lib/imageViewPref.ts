/**
 * Which view — the photograph or its transcribed text — you last looked at
 * for a given photographed-page thing. Per-thing, not global: a marked-up
 * page worth keeping as an image and a plain transcribed passage don't have
 * to agree on one app-wide default (see the plate's toggle, SpecimenPlate.tsx).
 *
 * A display preference only, so plain synchronous localStorage — same
 * posture as TodaysWalk's own stored state — rather than IndexedDB.
 */

import { readJson, writeJson } from '../../shared/storage'

const STORAGE_KEY = 'silva:image-view'

export type ImageViewMode = 'image' | 'text'

type Store = Record<string, ImageViewMode>

export function readImageViewMode(thingId: string): ImageViewMode | null {
  const store = readJson<Store>(STORAGE_KEY, {})
  return store[thingId] ?? null
}

export function writeImageViewMode(thingId: string, mode: ImageViewMode): void {
  const store = readJson<Store>(STORAGE_KEY, {})
  writeJson(STORAGE_KEY, { ...store, [thingId]: mode })
}
