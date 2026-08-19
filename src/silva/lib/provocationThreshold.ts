/**
 * The anti-feed rule, made real.
 *
 * SILVA.md is unambiguous: "At most one provocation is offered per session,
 * and **only when a real threshold is crossed. Silence is the default and a
 * valid state.** ... Provocations are earned by the collection having actually
 * changed or aged, not by you having opened the app."
 *
 * The once-per-session half of that was already enforced (see
 * provocationDismissals.ts). The *threshold* half was not: `pickProvocation`
 * always has Shuffle and Blind-pairing candidates whenever two things are
 * kept, so Silva greeted you with something on every single open — which is
 * precisely the feed the rule exists to prevent.
 *
 * A threshold is crossed when either:
 *
 *   1. **The collection changed** since the last provocation was offered —
 *      something kept or released, a locus coined, a path walked. Its
 *      fingerprint below is deliberately coarse: counts plus the newest
 *      `kept` date, so editing a note's wording is not "the collection
 *      changed", but keeping something is.
 *   2. **It aged** — `QUIET_DAYS` have passed with the collection standing
 *      still. A forest nobody has added to for a fortnight is exactly when
 *      bumping into an old thing is worth something; the rule is about not
 *      being a feed, not about going silent forever.
 *
 * Neither one, and Silva says nothing. That is the intended state, not a bug.
 */

import { readJson, writeJson } from '../../shared/storage'
import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'
import { daysSince } from './understory'

const STATE_KEY = 'silva:provocation-threshold'

/** Long enough that a daily user is never greeted twice for standing still,
 *  short enough that a forest left alone still eventually offers something. */
export const QUIET_DAYS = 14

export interface ThresholdState {
  /** The collection fingerprint at the moment a provocation was last offered. */
  fingerprint: string
  /** ISO date (YYYY-MM-DD) it was offered. */
  offered: string
}

/**
 * A coarse signature of the collection's *shape*, not its contents. Changing
 * the wording of a note must not count as the collection having changed;
 * keeping, releasing, coining and walking must.
 */
export function collectionFingerprint(things: Thing[], loci: Locus[], paths: Path[]): string {
  let kept = 0
  let understory = 0
  let newestKept = ''
  for (const thing of things) {
    if (thing.state === 'Kept') {
      kept++
      if (thing.kept && thing.kept > newestKept) newestKept = thing.kept
    } else if (thing.state === 'Understory') {
      understory++
    }
  }
  return [kept, understory, loci.length, paths.length, newestKept].join('|')
}

export function readThresholdState(): ThresholdState | null {
  return readJson<ThresholdState | null>(STATE_KEY, null)
}

export function recordProvocationOffered(fingerprint: string, today: Date = new Date()): void {
  writeJson(STATE_KEY, { fingerprint, offered: today.toISOString().slice(0, 10) } satisfies ThresholdState)
}

/**
 * Whether a provocation has been *earned*. True on the very first run (there
 * is nothing to compare against, and an empty app that says nothing at all
 * never explains what provocations are), then only on change or on age.
 */
export function thresholdCrossed(
  fingerprint: string,
  previous: ThresholdState | null,
  today: Date = new Date(),
): boolean {
  if (!previous) return true
  if (previous.fingerprint !== fingerprint) return true
  return daysSince(previous.offered, today) >= QUIET_DAYS
}
