/**
 * Today's walk — a short, finite stretch of the forest, chosen for you.
 *
 * SILVA.md asks the Forest to be "one thing at a time... Scroll is a walk, not
 * a list", and the implementation was a list sorted by `kept` descending. That
 * ordering is *stationary*: the top of the forest is the same five things every
 * time you open it, so past the first screen the collection is effectively
 * write-only. A collection whose job is "to make sure you keep bumping into
 * what you already kept" was guaranteeing you bumped into the five things you
 * were least likely to have forgotten.
 *
 * ── Why this is a walk and not a feed ───────────────────────────────────
 * The anti-feed rule is the app's spine, and a rotating set of things on the
 * home screen looks exactly like the thing it forbids. Three properties keep
 * them apart, and all three are enforced here rather than left to intent:
 *
 *   1. **It ends.** `WALK_SIZE` things, then an ending that offers nothing
 *      further. A feed is unbounded, so leaving is always your decision.
 *   2. **It is only ever your own kept things.** Nothing arrives from outside.
 *   3. **It refreshes on the calendar, not on your attention.** The ordering is
 *      seeded by the date, so opening Silva twice in an hour gives you the same
 *      walk both times — and should. A feed refreshes to reward returning.
 *
 * Break any one of those and this becomes the thing SILVA.md argues against.
 */

import type { Thing } from './notion'
import { daysSinceSeen, type SeenMap } from './seen'

export const WALK_SIZE = 5

/** A small, stable per-day-per-thing jitter, so two things last seen on the
 *  same day don't order by array position forever — but still land in the same
 *  order all day. Same cheap string hash as `embeddings.contentHash`. */
function jitter(id: string, dateKey: string): number {
  const text = `${id}:${dateKey}`
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  // 0..1, from the low bits — enough to break ties, far too small to outweigh
  // a real difference in days.
  return ((hash >>> 0) % 1000) / 1000
}

export interface WalkOptions {
  size?: number
  today?: Date
}

/**
 * Picks today's walk: the kept things you have gone longest without actually
 * looking at, tie-broken deterministically.
 *
 * Weighted by `daysSinceSeen` rather than by `kept`, which is the entire
 * reason `lib/seen.ts` exists — without it the only orderings available are
 * chronological (the original problem) or random, and random has no memory, so
 * it would show you the same thing twice in a week while missing others for a
 * year.
 */
export function chooseWalk(
  things: Thing[],
  seen: SeenMap,
  { size = WALK_SIZE, today = new Date() }: WalkOptions = {},
): Thing[] {
  const dateKey = today.toISOString().slice(0, 10)

  return things
    .filter((thing) => thing.state === 'Kept')
    .map((thing) => ({ thing, score: daysSinceSeen(thing, seen, today) + jitter(thing.id, dateKey) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map((scored) => scored.thing)
}

/** The walk is worth offering only once there is enough forest for it to be a
 *  *selection* rather than simply the whole collection restated. */
export function walkIsWorthwhile(things: Thing[], size = WALK_SIZE): boolean {
  return things.filter((thing) => thing.state === 'Kept').length > size
}
