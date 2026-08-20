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
import { cosineSimilarity } from './embeddings'
import { daysSinceSeen, type SeenMap } from './seen'
import { todayIso } from './understory'

export const WALK_SIZE = 5

/** How many of the most-neglected things are considered before the walk
 *  picks its route through them. Neglect stays the gate — nothing you read
 *  yesterday can be pulled back in by affinity — while the order *within*
 *  the pool becomes a traversal rather than a ranking. */
export const WALK_POOL_FACTOR = 4

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
  /** Cached embedding vectors, when the underground is switched on. Absent
   *  or empty simply means the walk is ordered by neglect alone — exactly
   *  what it did before it could route. */
  vectorsById?: Map<string, Float32Array>
}

/**
 * Picks today's walk: the kept things you have gone longest without actually
 * looking at — and then walks *between* them rather than counting them down.
 *
 * Weighted by `daysSinceSeen` rather than by `kept`, which is the entire
 * reason `lib/seen.ts` exists — without it the only orderings available are
 * chronological (the original problem) or random, and random has no memory, so
 * it would show you the same thing twice in a week while missing others for a
 * year.
 *
 * ── Why it routes, rather than just ranking ─────────────────────────────
 * Ranked by neglect alone, the walk was five unrelated things shown in a
 * queue: strict, systematic coverage of the collection, one page at a time.
 * That is a reading *schedule*, and it left the app's actual thesis — "keeps
 * putting them back in front of you, **next to each other**" — entirely to
 * the provocations. So the most-neglected thing still opens the walk, and
 * each following step is the one nearest what you just read. You drift
 * through a region of the forest instead of teleporting five times, and the
 * juxtaposition that produces is the whole point of the app.
 *
 * Neglect stays the gate, not a tie-break: only the most-neglected
 * `size * WALK_POOL_FACTOR` things are eligible at all, so affinity can
 * reorder the walk but can never drag back something you read yesterday.
 * With the underground off there are no vectors, every similarity is zero,
 * and this degrades exactly to the neglect ordering it had before.
 *
 * Still not a feed: it ends, it holds only your own kept things, and it is
 * seeded by the date — the same walk all day, however often you return.
 */
export function chooseWalk(
  things: Thing[],
  seen: SeenMap,
  { size = WALK_SIZE, today = new Date(), vectorsById }: WalkOptions = {},
): Thing[] {
  const dateKey = todayIso(today)

  const pool = things
    .filter((thing) => thing.state === 'Kept')
    .map((thing) => ({ thing, score: daysSinceSeen(thing, seen, today) + jitter(thing.id, dateKey) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size * WALK_POOL_FACTOR)

  const walk: Thing[] = []
  const remaining = [...pool]

  while (walk.length < size && remaining.length > 0) {
    const previous = walk[walk.length - 1]
    const previousVector = previous ? vectorsById?.get(previous.id) : undefined

    let bestIndex = 0
    if (previousVector) {
      let bestSimilarity = -Infinity
      remaining.forEach((candidate, index) => {
        const vector = vectorsById?.get(candidate.thing.id)
        // No vector yet (still indexing, or too short to embed) — it stays
        // eligible, just never wins on affinity. `remaining` is already in
        // neglect order, so index 0 is the fallback and the walk never
        // stalls waiting for the model.
        const similarity = vector ? cosineSimilarity(previousVector, vector) : -Infinity
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestIndex = index
        }
      })
    }

    walk.push(remaining.splice(bestIndex, 1)[0].thing)
  }

  return walk
}

/** The walk is worth offering only once there is enough forest for it to be a
 *  *selection* rather than simply the whole collection restated. */
export function walkIsWorthwhile(things: Thing[], size = WALK_SIZE): boolean {
  return things.filter((thing) => thing.state === 'Kept').length > size
}
