/**
 * When you last actually looked at a thing.
 *
 * Silva had no such signal, and one provocation kind was quietly lying about
 * it: `gatherLongUnvisited` filtered on `daysSince(thing.kept)`, so "long
 * unvisited" literally meant "kept more than 180 days ago". A thing you reread
 * every week and a thing you have never opened since the day you saved it were
 * indistinguishable — and worse, the pool only ever grew, because nothing you
 * did could drain it.
 *
 * This is the missing half. It is **derived state, on this device only** — the
 * same posture as the embedding vectors in `vectorCache.ts`. It is never
 * written to Notion, never synced, and throwing it away costs nothing but the
 * signal itself.
 *
 * ── The rule this must not break ────────────────────────────────────────
 * SILVA.md forbids the app from ranking, scoring or rating anything in the
 * collection. This does not violate that, and the distinction is load-bearing:
 * it measures *you*, not the things. So it stays invisible — never rendered as
 * a count, never as a visible ordering that reads as a leaderboard of your own
 * attention. It exists only to choose what to put in front of you, and the
 * choosing is silent.
 */

import { get, set } from 'idb-keyval'
import type { Thing } from './notion'
import { daysSince, todayIso } from './understory'

const STORE_KEY = 'silva:seen'

/** thing id -> ISO date (YYYY-MM-DD) it was last looked at. */
export type SeenMap = Record<string, string>

export async function readSeen(): Promise<SeenMap> {
  try {
    return (await get<SeenMap>(STORE_KEY)) ?? {}
  } catch {
    // A browser that refuses IndexedDB simply has no history — every thing
    // then falls back to its `kept` date, which is the old behaviour.
    return {}
  }
}

export async function writeSeen(seen: SeenMap): Promise<void> {
  try {
    await set(STORE_KEY, seen)
  } catch {
    // Not worth surfacing: the worst case is that this session's reading
    // isn't remembered.
  }
}

/**
 * Merges newly-seen ids into a map, returning a new map (or the original, if
 * nothing actually changed — so callers can skip a pointless write and a
 * pointless re-render).
 */
export function withSeen(seen: SeenMap, ids: Iterable<string>, today: Date = new Date()): SeenMap {
  const date = todayIso(today)
  let changed = false
  const next: SeenMap = { ...seen }
  for (const id of ids) {
    if (next[id] === date) continue
    next[id] = date
    changed = true
  }
  return changed ? next : seen
}

/**
 * How long since a thing was actually looked at — falling back to when it was
 * kept for anything with no history yet, which is exactly the old behaviour
 * and the right default: something you kept and never opened *has* been
 * unvisited since you kept it.
 */
export function daysSinceSeen(
  thing: Pick<Thing, 'id' | 'kept' | 'encountered'>,
  seen: SeenMap,
  today: Date = new Date(),
): number {
  const last = seen[thing.id] || thing.kept || thing.encountered
  if (!last) return 0
  return daysSince(last, today)
}

/** Drops history for things that no longer exist — same cheap housekeeping as
 *  `pruneVectors`. Returns the pruned map, or the original when nothing went. */
export function prunedSeen(seen: SeenMap, liveThingIds: Iterable<string>): SeenMap {
  const live = new Set(liveThingIds)
  const next: SeenMap = {}
  let dropped = 0
  for (const [id, date] of Object.entries(seen)) {
    if (live.has(id)) next[id] = date
    else dropped++
  }
  return dropped > 0 ? next : seen
}
