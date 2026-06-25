// Offline write-queue. A check-in or reflection that can't reach Notion (no signal) is parked
// here in IndexedDB and synced later (see lib/sync.ts). Because writes are idempotent per
// date / per week, the queue is KEYED by the logical target — repeated offline edits to the same
// day or week collapse to the latest, so syncing replays one write, not many.

import { get as idbGet, set as idbSet } from 'idb-keyval'
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

/** Async key/value backend; defaults to IndexedDB via idb-keyval, injectable for tests. */
export interface StoreLike {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
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
  return { get: (k) => idbGet(k), set: (k, v) => idbSet(k, v) }
}

async function readMap(store: StoreLike): Promise<Record<string, QueueItem>> {
  const v = await store.get(QUEUE_KEY)
  return v && typeof v === 'object' ? (v as Record<string, QueueItem>) : {}
}

/** All queued items, oldest first. */
export async function loadQueue(store: StoreLike = defaultStore()): Promise<QueueItem[]> {
  const map = await readMap(store)
  return Object.values(map).sort((a, b) => a.updatedAt - b.updatedAt)
}

/** Add or replace the item for its key (latest write wins). */
export async function enqueue(item: QueueItem, store: StoreLike = defaultStore()): Promise<void> {
  const map = await readMap(store)
  map[item.key] = item
  await store.set(QUEUE_KEY, map)
}

export async function dequeue(key: string, store: StoreLike = defaultStore()): Promise<void> {
  const map = await readMap(store)
  delete map[key]
  await store.set(QUEUE_KEY, map)
}

export async function queueSize(store: StoreLike = defaultStore()): Promise<number> {
  return Object.keys(await readMap(store)).length
}
