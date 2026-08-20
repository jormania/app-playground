import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../ds'
import type { Thing } from '../lib/notion'
import type { SeenMap } from '../lib/seen'
import { chooseWalk, walkIsWorthwhile } from '../lib/walk'
import { todayIso } from '../lib/understory'
import { readJson, writeJson } from '../../shared/storage'
import styles from './TodaysWalk.module.css'

const DONE_KEY = 'silva:walk-done'
const WALK_KEY = 'silva:walk'

interface StoredWalk {
  date: string
  ids: string[]
}

function today(): string {
  return todayIso()
}

export interface TodaysWalkProps {
  things: Thing[]
  seen: SeenMap
  /** Renders one thing at reading size. Passed in rather than imported so the
   *  walk and the scroll are provably the same plate, including its dwell
   *  tracking and its neighbourhood. */
  renderThing: (thing: Thing) => React.ReactNode
  /** Cached vectors, so the walk can route between neighbours rather than
   *  count down a ranking. Empty is fine — it falls back to neglect order. */
  vectorsById?: Map<string, Float32Array>
}

/**
 * A short, finite stretch of the forest, chosen for what you haven't looked at.
 *
 * SILVA.md asks the Forest to be a walk and it was a list sorted by recency,
 * which meant the same five things sat at the top every time and everything
 * older lived below a scroll wall. This sits above that scroll: not a
 * replacement for it, an addition — so nothing is taken away while the
 * question "will you actually take a walk" gets answered.
 *
 * ── Why this isn't a feed ───────────────────────────────────────────────
 * The anti-feed rule is the app's spine and a rotating set on the home screen
 * looks exactly like what it forbids. Three properties keep them apart, and
 * all three are structural rather than intentions:
 *
 *   1. **It ends**, and the ending offers nothing further — no "more", no
 *      next set. Just a line saying the walk is done.
 *   2. **Only your own kept things.** Nothing arrives from outside.
 *   3. **It refreshes on the calendar, not on your attention** — the order is
 *      seeded by the date (lib/walk.ts), so reopening Silva shows the same
 *      walk, and finishing it stays finished for the rest of the day.
 */
export function TodaysWalk({ things, seen, renderThing, vectorsById }: TodaysWalkProps) {
  const [index, setIndex] = useState(0)
  // Finishing is remembered for the day, so the walk doesn't reappear every
  // time you come back to the Forest — that alone would make it a feed.
  const [doneOn, setDoneOn] = useState<string>(() => readJson<string>(DONE_KEY, ''))

  /**
   * Today's walk, fixed for the calendar day and *persisted* — not merely
   * computed once per mount.
   *
   * Per-mount alone was not enough, and the bug it hid is the one that would
   * have turned this into a feed: reading a thing marks it seen, so leaving
   * the Forest and coming back would recompute the walk with fresh history,
   * drop what you had just read, and pull in something new. That is a set that
   * refreshes in response to your attention, which is the exact property
   * separating a feed from a walk (see lib/walk.ts). Storing the chosen ids
   * makes "the same walk all day" true rather than merely intended.
   */
  const walk = useMemo(() => {
    const date = today()
    const stored = readJson<StoredWalk | null>(WALK_KEY, null)

    if (stored && stored.date === date && Array.isArray(stored.ids)) {
      const byId = new Map(things.map((t) => [t.id, t]))
      // Anything released or deleted since this morning simply drops out; the
      // walk gets shorter rather than being silently re-picked.
      const restored = stored.ids.map((id) => byId.get(id)).filter((t): t is Thing => Boolean(t))
      if (restored.length > 0) return restored
    }

    const fresh = chooseWalk(things, seen, { vectorsById })
    writeJson(WALK_KEY, { date, ids: fresh.map((t) => t.id) } satisfies StoredWalk)
    return fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixed for the day, deliberately not reactive to `seen`
  }, [])

  // Resolved against the *live* collection on every render, not just at
  // mount. The memo above is deliberately non-reactive so the walk stays the
  // same set all day — but that also froze the Thing objects, so something
  // deleted or released mid-session went on being walked through, and a
  // deleted one rendered a plate for a thing that no longer existed. Keeping
  // the chosen *ids* fixed while re-resolving them each render preserves
  // "the same walk all day" without preserving things that have gone.
  const liveById = new Map(things.map((t) => [t.id, t]))
  const walkNow = walk
    .map((t) => liveById.get(t.id))
    .filter((t): t is Thing => Boolean(t) && t!.state === 'Kept')

  const finished = doneOn === today()

  useEffect(() => {
    if (index >= walkNow.length && walkNow.length > 0 && !finished) {
      const date = today()
      writeJson(DONE_KEY, date)
      setDoneOn(date)
    }
  }, [index, walkNow.length, finished])

  if (!walkIsWorthwhile(things) || walkNow.length === 0) return null

  if (finished) {
    return (
      <section className={styles.doneWrap}>
        <p className={styles.doneText}>
          This walk is done for now. The forest is below, and there's more whenever you're ready.
        </p>
      </section>
    )
  }

  const current = walkNow[Math.min(index, walkNow.length - 1)]
  const isLast = index === walkNow.length - 1

  return (
    <section className={styles.wrap} aria-label="The walk">
      <div className={styles.head}>
        <span className={styles.eyebrow}>The walk</span>
        <span className={styles.position}>{index + 1} of {walkNow.length}</span>
      </div>

      {renderThing(current)}

      <div className={styles.foot}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Back
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIndex(walkNow.length)}>
          End the walk
        </Button>
        <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
          {isLast ? 'Finish' : 'Onward'}
        </Button>
      </div>
    </section>
  )
}
