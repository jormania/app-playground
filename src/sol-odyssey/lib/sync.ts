// Sync engine: replay the offline queue to Notion when we're back online. existingId is resolved
// at flush time (one fresh list per odyssey) so a queued "create" never duplicates a row that
// already exists server-side — last-write-wins, no dupes.

import type { Settings } from './settings'
import {
  listCheckins as realListCheckins,
  listReflections as realListReflections,
  upsertCheckin as realUpsertCheckin,
  upsertReflection as realUpsertReflection,
  type UpsertCheckinArgs,
  type UpsertReflectionArgs,
} from './notion'
import type { CheckinRecord } from './checkins'
import type { ReflectionRecord } from './reflections'
import { dequeue, loadQueue, queueSize, type StoreLike } from './queue'

export interface SyncDeps {
  listCheckins: (settings: Settings, odysseyId: string) => Promise<CheckinRecord[]>
  upsertCheckin: (settings: Settings, args: UpsertCheckinArgs) => Promise<unknown>
  listReflections: (settings: Settings, odysseyId: string) => Promise<ReflectionRecord[]>
  upsertReflection: (settings: Settings, args: UpsertReflectionArgs) => Promise<unknown>
  store?: StoreLike
}

const realDeps: SyncDeps = {
  listCheckins: realListCheckins,
  upsertCheckin: realUpsertCheckin,
  listReflections: realListReflections,
  upsertReflection: realUpsertReflection,
}

/** Best-effort online check (true when undeterminable, e.g. in tests/SSR). */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true
}

/** True for failures that mean "we never reached Notion" — offline, dropped fetch, or the relay
 *  being unreachable — i.e. the cases we should queue rather than surface as a hard error. */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const msg = (err as { message?: string })?.message ?? ''
  return /failed to fetch|networkerror|load failed|reach the notion relay/i.test(msg)
}

/** A custom event the mutation hooks fire after touching the queue, so the SyncProvider can
 *  refresh its pending count and attempt a flush. */
export const SYNC_EVENT = 'sol-odyssey:sync'
export function notifySyncChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_EVENT))
}

export interface FlushResult {
  synced: number
  remaining: number
}

/** Replay queued writes to Notion. Stops on the first failure (likely offline again), keeping
 *  the rest queued. No-op when offline. */
export async function flushQueue(settings: Settings, deps: SyncDeps = realDeps): Promise<FlushResult> {
  const store = deps.store
  if (!isOnline()) return { synced: 0, remaining: await queueSize(store) }

  const items = await loadQueue(store)
  const checkinLists = new Map<string, CheckinRecord[]>()
  const reflectionLists = new Map<string, ReflectionRecord[]>()
  let synced = 0

  for (const item of items) {
    try {
      if (item.kind === 'checkin') {
        let list = checkinLists.get(item.odysseyId)
        if (!list) {
          list = await deps.listCheckins(settings, item.odysseyId)
          checkinLists.set(item.odysseyId, list)
        }
        const existingId = list.find((r) => r.date === item.dateISO)?.id
        await deps.upsertCheckin(settings, {
          odysseyId: item.odysseyId,
          odysseyNumber: item.odysseyNumber,
          dateISO: item.dateISO,
          dayIndex: item.dayIndex,
          existingId,
          draft: item.draft,
        })
      } else {
        let list = reflectionLists.get(item.odysseyId)
        if (!list) {
          list = await deps.listReflections(settings, item.odysseyId)
          reflectionLists.set(item.odysseyId, list)
        }
        const existingId = list.find((r) => r.weekIndex === item.weekIndex)?.id
        await deps.upsertReflection(settings, {
          odysseyId: item.odysseyId,
          odysseyNumber: item.odysseyNumber,
          weekIndex: item.weekIndex,
          dateISO: item.dateISO,
          existingId,
          draft: item.draft,
        })
      }
      await dequeue(item.key, store)
      synced += 1
    } catch {
      break // keep this and the remaining items for the next attempt
    }
  }

  return { synced, remaining: await queueSize(store) }
}
