// Offline write-queue. A check-in or reflection that can't reach Notion (no signal) is parked
// here in IndexedDB and synced later (see lib/sync.ts). Because writes are idempotent per
// date / per week, the queue is KEYED by the logical target — repeated offline edits to the same
// day or week collapse to the latest, so syncing replays one write, not many.

import { get as idbGet, set as idbSet, update as idbUpdate } from 'idb-keyval'
import type { CheckinDraft } from './checkins'
import type { ReflectionDraft } from './reflections'

export interface CheckinQueueItem {
  kind: 'checkin'
  key: string
  odysseyId: string
  odysseyNumber: number
  dateISO: string
  dayIndex: number
  draft: CheckinDraft
  updatedAt: number
}

export interface ReflectionQueueItem {
  kind: 'reflection'
  key: string
  odysseyId: string
  odysseyNumber: number
  dateISO: string
  weekIndex: number
  draft: ReflectionDraft
  updatedAt: number
}

export type QueueItem = CheckinQueueItem | ReflectionQueueItem

/** Async key/value backend; defaults to IndexedDB via idb-keyval, injectable for tests.
 *  `update` is an atomic read-modify-write (one IDB transaction) — enqueue/dequeue use it when
 *  available so a flush racing a new enqueue can never drop the newer write. */
export interface StoreLike {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  update?(key: string, fn: (old: unknown) => unknown): Promise<void>
}

const QUEUE_KEY = 'sol-odyssey:queue'

export const checkinKey = (odysseyId: string, dateISO: string) => `checkin:${odysseyId}:${dateISO}`
export const reflectionKey = (odysseyId: string, week: number) => `reflection:${odysseyId}:${week}`

export function checkinItem(
  odyssey: { id: string; number: number },
  dateISO: string,
  dayIndex: number,
  draft: CheckinDraft,
): CheckinQueueItem {
  return {
    kind: 'checkin',
    key: checkinKey(odyssey.id, dateISO),
    odysseyId: odyssey.id,
    odysseyNumber: odyssey.number,
    dateISO,
    dayIndex,
    draft,
    updatedAt: Date.now(),
  }
}

export function reflectionItem(
  odyssey: { id: string; number: number },
  weekIndex: number,
  dateISO: string,
  draft: ReflectionDraft,
): ReflectionQueueItem {
  return {
    kind: 'reflection',
    key: reflectionKey(odyssey.id, weekIndex),
    odysseyId: odyssey.id,
    odysseyNumber: odyssey.number,
    dateISO,
    weekIndex,
    draft,
    updatedAt: Date.now(),
  }
}

function defaultStore(): StoreLike {
  return { get: (k) => idbGet(k), set: (k, v) => idbSet(k, v), update: (k, fn) => idbUpdate(k, fn) }
}

function asMap(v: unknown): Record<string, QueueItem> {
  return v && typeof v === 'object' ? (v as Record<string, QueueItem>) : {}
}

async function readMap(store: StoreLike): Promise<Record<string, QueueItem>> {
  return asMap(await store.get(QUEUE_KEY))
}

/** Apply `mutator` to the queue map. Uses the store's atomic `update` when available (the real
 *  IndexedDB backend) so a concurrent enqueue/dequeue can never be lost between a read and its
 *  write-back; falls back to a plain get+set for stores that don't support it (e.g. tests). */
async function mutateMap(
  mutator: (map: Record<string, QueueItem>) => Record<string, QueueItem>,
  store: StoreLike,
): Promise<void> {
  if (store.update) {
    await store.update(QUEUE_KEY, (v) => mutator(asMap(v)))
    return
  }
  await store.set(QUEUE_KEY, mutator(await readMap(store)))
}

/** All queued items, oldest first. */
export async function loadQueue(store: StoreLike = defaultStore()): Promise<QueueItem[]> {
  const map = await readMap(store)
  return Object.values(map).sort((a, b) => a.updatedAt - b.updatedAt)
}

/** Add or replace the item for its key (latest write wins). */
export async function enqueue(item: QueueItem, store: StoreLike = defaultStore()): Promise<void> {
  await mutateMap((map) => ({ ...map, [item.key]: item }), store)
}

export async function dequeue(key: string, store: StoreLike = defaultStore()): Promise<void> {
  await mutateMap((map) => {
    const next = { ...map }
    delete next[key]
    return next
  }, store)
}

export async function queueSize(store: StoreLike = defaultStore()): Promise<number> {
  return Object.keys(await readMap(store)).length
}
