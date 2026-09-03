/**
 * Captures this device has taken but Notion has not yet heard about.
 *
 * Silva is local-first for *reading*: the collection is mirrored to the
 * device, and an unreachable Notion means yesterday's forest rather than an
 * error page. Writing had no equivalent. Every handler applies optimistically
 * and rolls back on failure (`App.tsx`'s `write`), which is right for an edit
 * — the thing is still there, unchanged, and you can try again — and quietly
 * wrong for a capture, where the rollback throws away something that exists
 * nowhere else. Share a link on the metro and the app takes it, shows it in
 * the nursery, and drops it a second later with a toast.
 *
 * ── Why only captures ───────────────────────────────────────────────────
 * A general write queue has to answer what happens when a queued edit meets
 * a row that changed underneath it, and in what order to replay a keep, a
 * release and a delete of the same thing. Getting that wrong corrupts a
 * collection quietly, which is the one failure mode this app can least
 * afford.
 *
 * A capture asks none of those questions. It is a new row that depends on no
 * prior state, so it can be replayed an hour later or tomorrow and the answer
 * is the same. That is the whole boundary: everything else still rolls back
 * and says so, because for everything else the rollback is honest.
 *
 * Photographs are not queued either — the bytes are the hard part, and the
 * photo lane already keeps them on the device (`lib/photoStore.ts`). This
 * holds text.
 *
 * ── What is stored ──────────────────────────────────────────────────────
 * The *capture*, not the draft thing. A source arrives here as the text you
 * typed rather than a resolved id, because ids minted on this device mean
 * nothing to Notion, and because by the time the queue drains that same
 * publication may already exist in the forest — re-resolving at flush is what
 * keeps a queued capture from creating the second "Ness Labs".
 *
 * `encountered` is stamped when the capture happened, never when it drains:
 * the day a thing reached you is a fact about that day.
 */
import { get, set, del, keys } from 'idb-keyval'
import type { ThingKind } from './notion'

const PREFIX = 'silva:outbox:'

/** One capture, in the shape `handleIntake` would have committed. */
export interface QueuedCapture {
  /** The draft id the optimistic row is already showing under, so the row on
   *  screen and the entry in the queue are the same thing. */
  id: string
  body: string
  locator: string
  /** What was typed in the source field — resolved against the forest at
   *  flush time, not stored as an id. */
  sourceInput: string
  /**
   * A source the capture *inherited* rather than typed: a cutting takes the
   * source of the thing it was taken from, and re-resolving that from a
   * title would be guessing at something already known exactly.
   *
   * Only ever a live Notion id. A capture whose parent was itself waiting in
   * this queue has nothing real to inherit, and falls back to `sourceInput`
   * like everything else — which for a cutting means no source, and a source
   * you can add by hand later is a smaller loss than a dangling reference.
   */
  sourceId?: string | null
  link: string | null
  kind: ThingKind | null
  /** The day the capture happened, not the day it drains. */
  encountered: string
  /** For draining oldest-first, so a forest ends up in the order you built
   *  it rather than the order IndexedDB felt like. */
  queuedAt: number
}

const entryKey = (id: string) => `${PREFIX}${id}`

/**
 * True when a failure means "this device could not reach anything", as
 * against Notion having answered and refused.
 *
 * The test is the absence of a status: `SilvaStore` throws `SilvaStoreError`
 * with the HTTP status for everything the relay answers, and status `0` for
 * its own configuration errors ("No Things database configured"), neither of
 * which a queue would ever resolve by waiting. A `fetch` that never got a
 * response throws a `TypeError` with no status at all, and that — offline,
 * aeroplane mode, a dead tunnel on the metro — is the one case worth keeping.
 */
export function looksOffline(error: unknown): boolean {
  return typeof (error as { status?: number } | null)?.status !== 'number'
}

/** Adds a capture to the queue. Never throws: a device with no usable
 *  IndexedDB is worse off, but it is not worse off *for having tried*, and
 *  the caller has already told you on screen. */
export async function queueCapture(capture: QueuedCapture): Promise<boolean> {
  try {
    await set(entryKey(capture.id), capture)
    return true
  } catch {
    return false
  }
}

/** Everything waiting, oldest first. */
export async function queuedCaptures(): Promise<QueuedCapture[]> {
  try {
    const entries: QueuedCapture[] = []
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) continue
      const entry = await get<QueuedCapture>(key)
      if (entry && typeof entry.id === 'string' && typeof entry.body === 'string') entries.push(entry)
    }
    return entries.sort((a, b) => a.queuedAt - b.queuedAt)
  } catch {
    return []
  }
}

/** Forgets one, once Notion has it. Called *before* the local row is
 *  reconciled, so a crash in between leaves a thing that exists in both
 *  places rather than one queued to be written twice. */
export async function forgetCapture(id: string): Promise<void> {
  try {
    await del(entryKey(id))
  } catch {
    // Nothing to do about it, and re-sending a capture is a duplicate row
    // rather than a loss — the lesser of the two.
  }
}
