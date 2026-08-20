/**
 * The whole collection, mirrored on the device, so opening Silva shows the
 * forest instead of "Walking into the forest…".
 *
 * ── Why the wait exists at all ──────────────────────────────────────────
 * Every open re-read all four databases from Notion before the first paint,
 * and `fetchAllPages` walks a database 100 rows at a time *sequentially* —
 * each request needs the previous one's cursor. So the wait is not a fixed
 * cost, it grows with the collection: ~1 round trip per 100 things, before
 * anything at all is on screen. A forest that takes a year to build takes
 * proportionally longer to open every single morning, which is precisely
 * backwards for an app whose whole promise is that you keep bumping into
 * what you kept.
 *
 * ── Why a cache rather than paging the UI ───────────────────────────────
 * The obvious fix — load twenty things and fetch more on scroll — cannot
 * work here, and it's worth writing down why so nobody tries it later.
 * Silva's features are *whole-collection* features: the walk weights every
 * kept thing by neglect (`lib/walk.ts`), a neighbourhood compares one thing
 * against all of them, Forage searches everything, provocations look for
 * tension anywhere in the collection, and the crossing draws the entire
 * graph. Paging the *data* would mean the walk could only ever offer you
 * something you had already scrolled past — the opposite of the feature.
 *
 * So the data stays whole and the *loading* changes: read the last known
 * collection from IndexedDB, render it immediately, and reconcile with
 * Notion in the background. The forest is on screen in milliseconds and
 * corrects itself a moment later. (Rendering is paged separately, in
 * ForestView — that part of the instinct is right, just at the other layer.)
 *
 * ── Staleness, which is the whole risk ──────────────────────────────────
 * A cache that shows the wrong thing is worse than a slow one. Three rules
 * keep this honest:
 *
 * 1. **The cache is never the last word.** Every open revalidates against
 *    Notion; the cached render is a head start, not a destination.
 * 2. **Silva's own writes update the cache immediately** — they already
 *    update React state optimistically (App.tsx's `write`), and the cache is
 *    written from that same state, so anything you do in the app is never
 *    stale to itself.
 * 3. **An edit made directly in Notion is caught by the incremental sync**
 *    (`last_edited_time`), and a *deletion* made directly in Notion is
 *    caught by the periodic full sync below — see `needsFullSync`.
 *
 * That last asymmetry is the one real trade and deserves naming: an
 * incremental query returns rows that changed, and a deleted row does not
 * come back at all — it simply stops appearing. Nothing incremental can
 * distinguish "deleted" from "unchanged". So a full reconcile runs whenever
 * the last one is older than `FULL_SYNC_INTERVAL_MS`, bounding how long a
 * row deleted from the Notion side can linger in a device that hasn't been
 * told. Deleting from Silva itself is immediate, as rule 2 says. A
 * pull-to-refresh forces one on demand (`wasPageReloaded`), so the bound is
 * never something anyone has to wait out.
 *
 * ── Known limit: two tabs of the same collection ────────────────────────
 * Both mirror to the same key, and neither knows about the other. Delete
 * something in one tab and the other — still holding the row in its own
 * state — writes it back to the cache on its next change, so the next open
 * can show it again until a full reconcile. Coordinating that properly
 * needs a BroadcastChannel and a shared notion of which state is newer,
 * which is a large amount of machinery for a personal app that is almost
 * always open in one place. The repairs above (the daily reconcile, and a
 * pull-to-refresh) both fix it, so this is recorded rather than solved.
 */
import { get, set } from 'idb-keyval'
import type { Thing } from './notion'
import type { Source } from './sources'
import type { Locus } from './loci'
import type { Path } from './paths'

const CACHE_KEY = 'silva:collection'

/**
 * Bumped whenever the *shape* of a cached record changes, so a build that
 * adds a field can never read an older cache that lacks it and render
 * `undefined` where a value belongs. A version miss discards the cache and
 * falls back to a full load — one slow open, rather than a subtly wrong one.
 *
 * v1: things/sources/loci/paths as of `Thing.arrived` (the season anchor).
 */
const SCHEMA_VERSION = 1

/**
 * How long a cache may go without a full reconcile before one is forced.
 * The bound on how stale a *deletion made directly in Notion* can be; every
 * other kind of change is picked up incrementally on every open.
 *
 * A day is chosen over anything shorter because a full sweep is exactly the
 * cost this module exists to avoid, and over anything longer because a
 * collection quietly disagreeing with its source for a week is its own kind
 * of wrong.
 */
export const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * A short, irreversible fingerprint of the Notion token, so a cache written
 * by one account is never rendered for another. Not a security measure and
 * not treated as one — the token itself already lives in localStorage
 * (lib/settingsConfig.ts); this only needs to answer "same collection as
 * last time?", and a 32-bit hash answers that without storing the secret a
 * second time.
 */
export function fingerprintToken(token: string): string {
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    hash = (Math.imul(31, hash) + token.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export interface CachedCollection {
  version: number
  /** Which token's collection this is — see `fingerprintToken`. */
  token: string
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  paths: Path[]
  /**
   * When this cache last agreed with Notion — the high-water mark an
   * incremental sync asks for changes *after*. ISO 8601, because that is
   * what Notion's `last_edited_time` filter takes.
   */
  syncedAt: string
  /** When a *complete* re-read last happened, for `needsFullSync`. */
  fullSyncedAt: string
}

/**
 * The cached collection, or null when there isn't one worth using — no
 * cache, a cache from an older schema, or an unreadable IndexedDB. Never
 * throws: every caller's fallback is simply the full load that used to be
 * unconditional.
 */
export async function readCollectionCache(token: string): Promise<CachedCollection | null> {
  try {
    const cached = await get<CachedCollection>(CACHE_KEY)
    if (!cached || cached.version !== SCHEMA_VERSION) return null
    // A different token is a different collection. Falling back to a full
    // load costs one slow open; rendering someone else's forest would be
    // unforgivable.
    if (cached.token !== fingerprintToken(token)) return null
    // A cache missing any of the four lists is a partial write from an
    // interrupted session, not something to render half of.
    if (!Array.isArray(cached.things) || !Array.isArray(cached.sources)) return null
    if (!Array.isArray(cached.loci) || !Array.isArray(cached.paths)) return null
    return cached
  } catch {
    return null
  }
}

/**
 * Mirrors the collection to the device. Best-effort: a full or unavailable
 * IndexedDB costs the next open its head start and nothing else, so this
 * never surfaces an error into a session that is otherwise working.
 */
export async function writeCollectionCache(
  token: string,
  collection: Omit<CachedCollection, 'version' | 'token'>,
): Promise<void> {
  try {
    await set(CACHE_KEY, {
      ...collection,
      version: SCHEMA_VERSION,
      token: fingerprintToken(token),
    } satisfies CachedCollection)
  } catch {
    // Nothing on screen depends on this.
  }
}

/**
 * How far *before* the last sync an incremental read starts.
 *
 * The high-water mark is stamped from the device's clock, but it is compared
 * against `last_edited_time`, which is Notion's. Those are not the same
 * clock. A device running even slightly fast asks for changes after a moment
 * that, server-side, has not happened yet — and silently receives nothing,
 * every open, until the daily full reconcile finally notices. Missing
 * changes quietly is the worst failure this module has, so the read starts
 * an hour early and simply re-sees anything it already had.
 *
 * That costs nothing in practice: the query returns *rows changed in the
 * last hour*, which for one person's commonplace book is almost always none,
 * and `mergeById` replaces by id so a row seen twice is a no-op. It also
 * closes a second, subtler gap — a row edited *while* a sync is paginating
 * could previously fall between the stamp and the read.
 *
 * Skew beyond an hour still degrades to "corrected at the next full sync",
 * which a pull-to-refresh triggers on demand (`wasPageReloaded`).
 */
export const SYNC_OVERLAP_MS = 60 * 60 * 1000

/**
 * Where an incremental read should start given the last sync, or undefined
 * when there is no usable mark — in which case the caller must read
 * everything rather than guess, since an unparseable date is not evidence
 * that nothing changed.
 */
export function incrementalSince(syncedAt: string): string | undefined {
  const at = Date.parse(syncedAt)
  if (!Number.isFinite(at)) return undefined
  return new Date(at - SYNC_OVERLAP_MS).toISOString()
}

/**
 * Whether this page load was a *reload* rather than an ordinary launch.
 *
 * Pulling down from the top of an installed PWA reloads the page, and that
 * gesture means one thing: "fetch everything again, I think what I'm looking
 * at is wrong." It is the one moment a reader explicitly asks for
 * correctness over speed, so it earns a full reconcile — the only kind of
 * read that can notice a row deleted directly in Notion, which otherwise
 * waits out `FULL_SYNC_INTERVAL_MS`.
 *
 * Launching the app from the homescreen is a `navigate`, not a `reload`, so
 * the everyday open stays incremental and cheap. Anything unreadable — an
 * older browser, a missing Navigation Timing entry — answers false and
 * falls back to the interval, which is the safe direction: at worst the
 * refresh is as good as it was before this existed.
 */
export function wasPageReloaded(): boolean {
  try {
    if (typeof performance === 'undefined') return false
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return entry?.type === 'reload'
  } catch {
    return false
  }
}

/**
 * Whether a complete re-read is due — no cache, no record of a full sync, or
 * one older than `FULL_SYNC_INTERVAL_MS`. Also true for a nonsense timestamp,
 * so a corrupted date fails safe toward correctness rather than toward speed.
 */
export function needsFullSync(
  cached: CachedCollection | null,
  now: number = Date.now(),
): boolean {
  if (!cached) return true
  const last = Date.parse(cached.fullSyncedAt)
  if (!Number.isFinite(last)) return true
  return now - last >= FULL_SYNC_INTERVAL_MS
}

/**
 * Folds a batch of changed rows into a cached list, by id.
 *
 * Notion returns whole rows, so a changed row *replaces* its cached self
 * rather than merging into it — a field cleared in Notion has to come back
 * as cleared, which a property-wise merge would quietly refuse to do. New
 * ids are appended; untouched rows keep their place, so an incremental sync
 * never reshuffles the collection under the reader.
 */
export function mergeById<T extends { id: string }>(cached: T[], changed: T[]): T[] {
  if (changed.length === 0) return cached
  const changedById = new Map(changed.map((row) => [row.id, row]))
  const merged = cached.map((row) => changedById.get(row.id) ?? row)
  const seen = new Set(cached.map((row) => row.id))
  for (const row of changed) {
    if (!seen.has(row.id)) merged.push(row)
  }
  return merged
}
