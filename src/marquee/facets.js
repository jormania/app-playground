// The status facets — the row under the filter cascade.
//
// They are a different KIND of filter from the cascade above them, which is why
// they are not a fourth level of it: type → venue → hall narrows *where* you are
// looking, each level scoped by the one above (§9.60). A facet asks about the
// STATE of a production — sold out, kept, watched, ignored, changed since the
// last check — and cuts across the whole chain rather than narrowing within it.
//
// Each facet carries three things:
//
// - `test`   — what belongs in it.
// - `lifts`  — which of Settings' "hide this" preferences it switches off. A
//              standing preference and an explicit press are the same person
//              disagreeing with themselves, and the press just made wins: Kept
//              has to show kept runs even with "hide what I've kept" on, or the
//              button does nothing at all (§9.64's second finding, generalised).
//              `hideIgnored` is deliberately lifted by ONE facet only — ignoring
//              is a per-item decision you made about that show, not a display
//              preference, so only Ignored itself brings them back.
// - `empty`  — what to say when it selects nothing. "Nothing upcoming at any of
//              your venues" is false with a facet on, and sends you looking for
//              a failed check instead of at the button you pressed.
//
// Pure — no React, no storage. `applyFacet` is the single definition of what a
// facet shows, used both for the list on screen and for the number on the chip,
// so the two cannot disagree.

import { TRIAGE } from './programme.js'

export const FACET = {
  CHANGED: 'changed',
  ON_SALE: 'on-sale',
  SOLD_OUT: 'sold-out',
  KEPT: 'kept',
  WATCHING: 'watching',
  IGNORED: 'ignored',
}

/** In the order they are drawn, which is roughly "what the venue did" →
 *  "what you did about it": what changed, what you can buy, what you can't,
 *  then the three marks that are yours. */
export const FACETS = [
  {
    id: FACET.CHANGED,
    label: 'Changed',
    title: 'Only what this check turned up — new listings, tickets opening, returns, sell-outs',
    // A change is recorded per SHOWING; a card is a production. One changed
    // night is enough to make the card worth looking at.
    test: (p, { changedKeys }) => p.showings.some((s) => changedKeys?.has(s.key)),
    // A sell-out IS a change, and a run you've kept can still change.
    lifts: { hideSoldOut: false, hideKept: false },
    empty: 'Nothing changed since the last check.',
  },
  {
    id: FACET.ON_SALE,
    label: 'On sale',
    title: 'Only runs with at least one date you can still buy',
    test: (p) => p.anyOpen,
    lifts: {},
    empty: 'Nothing here has tickets on sale.',
  },
  {
    id: FACET.SOLD_OUT,
    label: 'Sold out',
    title: 'Only runs where every date is gone — the ones worth watching',
    test: (p) => p.allSoldOut,
    lifts: { hideSoldOut: false },
    empty: 'Nothing here is sold out.',
  },
  {
    id: FACET.KEPT,
    label: 'Kept',
    title: 'Only what you’ve already kept in Wanderlist',
    // `saved` rather than `savedAll`: one night of a run kept still shows the
    // "in Wanderlist" chip, so it belongs here too.
    test: (p) => Boolean(p.saved),
    lifts: { hideKept: false },
    empty: 'You haven’t kept anything here yet.',
  },
  {
    id: FACET.WATCHING,
    label: 'Watching',
    title: 'Only what you’re watching for a return',
    test: (p, { watchlist }) => Boolean(watchlist?.[p.id]),
    // Most of a watchlist is sold out, and a watched run can be kept once it
    // comes back — neither preference may empty this view.
    lifts: { hideSoldOut: false, hideKept: false },
    empty: 'Nothing you’re watching is on right now.',
  },
  {
    id: FACET.IGNORED,
    label: 'Ignored',
    title: 'Only what you’ve ignored — the one place they show without changing a setting',
    test: (p, { triage }) => triage?.[p.id] === TRIAGE.IGNORED,
    lifts: { hideIgnored: false },
    empty: 'You haven’t ignored anything here.',
  },
]

export function facetById(id) {
  return FACETS.find((f) => f.id === id) ?? null
}

/**
 * The productions a facet shows, out of an already-scoped list.
 *
 * `productions` is expected to carry NO hiding of its own — the preferences are
 * applied here, minus whatever this facet lifts, so that one call answers both
 * "what do I draw" and "what number goes on the chip". A null `facet` is the
 * Everything case: preferences as set, no state test.
 */
export function applyFacet(productions, facet, { prefs = {}, triage = {}, watchlist = {}, changedKeys = new Map() } = {}) {
  const def = typeof facet === 'string' ? facetById(facet) : facet
  const lifts = def?.lifts ?? {}
  const hideIgnored = lifts.hideIgnored ?? !prefs.showIgnored
  const hideSoldOut = lifts.hideSoldOut ?? Boolean(prefs.hideSoldOut)
  const hideKept = lifts.hideKept ?? Boolean(prefs.hideKept)
  const ctx = { triage, watchlist, changedKeys }
  return (productions ?? []).filter((p) => {
    if (hideIgnored && triage[p.id] === TRIAGE.IGNORED) return false
    if (hideSoldOut && p.allSoldOut) return false
    if (hideKept && p.savedAll) return false
    return def ? def.test(p, ctx) : true
  })
}

/** The three "hide this" preferences as the given facet leaves them — what
 *  `visibleProductions` should be handed while that facet is on. */
export function hidesFor(facet, prefs = {}) {
  const lifts = (typeof facet === 'string' ? facetById(facet) : facet)?.lifts ?? {}
  return {
    hideIgnored: lifts.hideIgnored ?? !prefs.showIgnored,
    hideSoldOut: lifts.hideSoldOut ?? Boolean(prefs.hideSoldOut),
    hideKept: lifts.hideKept ?? Boolean(prefs.hideKept),
  }
}
