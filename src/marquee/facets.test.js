import { describe, it, expect } from 'vitest'
import { FACET, FACETS, applyFacet, facetById, hidesFor } from './facets.js'
import { TRIAGE } from './programme.js'

// §9.65 — the facet row, as data. The point of putting these in one table is
// that the list on screen and the number on the chip come from the same call;
// these tests are mostly about the second half of that.

const p = (over = {}) => ({
  id: over.id ?? 'excelsior::tomcat',
  title: 'Tomcat',
  venue: 'Teatrul Excelsior',
  showings: [{ key: 'k1' }],
  anyOpen: false,
  allSoldOut: false,
  saved: false,
  savedAll: false,
  ...over,
})

const ctx = (over = {}) => ({ prefs: {}, triage: {}, watchlist: {}, changedKeys: new Map(), ...over })

describe('the facets', () => {
  it('each select what they say they do', () => {
    const changed = p({ id: 'a', showings: [{ key: 'k1' }, { key: 'k2' }] })
    const onSale = p({ id: 'b', anyOpen: true })
    const gone = p({ id: 'c', allSoldOut: true })
    const kept = p({ id: 'd', saved: true })
    const watched = p({ id: 'e' })
    const ignored = p({ id: 'f' })
    const all = [changed, onSale, gone, kept, watched, ignored]
    const context = ctx({
      changedKeys: new Map([['k2', 'tickets-opened']]),
      watchlist: { e: { title: 'Tomcat', venue: 'Teatrul Excelsior' } },
      triage: { f: TRIAGE.IGNORED },
      prefs: { showIgnored: true },
    })
    const ids = (facet) => applyFacet(all, facet, context).map((x) => x.id)

    expect(ids(FACET.CHANGED)).toEqual(['a'])
    expect(ids(FACET.ON_SALE)).toEqual(['b'])
    expect(ids(FACET.SOLD_OUT)).toEqual(['c'])
    expect(ids(FACET.KEPT)).toEqual(['d'])
    expect(ids(FACET.WATCHING)).toEqual(['e'])
    expect(ids(FACET.IGNORED)).toEqual(['f'])
    // No facet is everything the cascade left standing.
    expect(ids(null)).toHaveLength(6)
  })

  it('counts one night of a run as kept, the way the card’s own chip does', () => {
    // "1 of 3 dates kept" still shows the in-Wanderlist chip, so it belongs
    // under Kept — `saved`, not `savedAll`.
    const part = p({ saved: true, savedAll: false })
    expect(applyFacet([part], FACET.KEPT, ctx())).toEqual([part])
  })

  it('lets a press override the preference that would empty it', () => {
    const prefs = { hideSoldOut: true, hideKept: true, showIgnored: false }
    const gone = p({ id: 'c', allSoldOut: true })
    const kept = p({ id: 'd', saved: true, savedAll: true })
    const ignored = p({ id: 'f' })
    const all = [gone, kept, ignored]
    const context = ctx({ prefs, triage: { f: TRIAGE.IGNORED }, watchlist: { c: {} } })

    // Without this, each of these buttons reads 0 and shows nothing to the one
    // person whose settings make it worth pressing.
    expect(applyFacet(all, FACET.SOLD_OUT, context).map((x) => x.id)).toEqual(['c'])
    expect(applyFacet(all, FACET.KEPT, context).map((x) => x.id)).toEqual(['d'])
    expect(applyFacet(all, FACET.IGNORED, context).map((x) => x.id)).toEqual(['f'])
    expect(applyFacet(all, FACET.WATCHING, context).map((x) => x.id)).toEqual(['c'])
    // Everything still honours all three, as it always did.
    expect(applyFacet(all, null, context)).toEqual([])
  })

  it('brings ignored shows back for exactly one facet', () => {
    // Ignoring is a decision about that show, not a display preference — so a
    // facet about ticket state must not quietly undo it.
    const ignored = p({ id: 'f', anyOpen: true, allSoldOut: false })
    const context = ctx({ triage: { f: TRIAGE.IGNORED }, prefs: { showIgnored: false } })
    expect(applyFacet([ignored], FACET.ON_SALE, context)).toEqual([])
    expect(applyFacet([ignored], FACET.IGNORED, context)).toEqual([ignored])
    for (const facet of FACETS) {
      const lifted = facet.lifts.hideIgnored === false
      expect(lifted).toBe(facet.id === FACET.IGNORED)
    }
  })

  it('gives every facet a line to print when it selects nothing', () => {
    for (const facet of FACETS) {
      expect(typeof facet.empty).toBe('string')
      expect(facet.empty.length).toBeGreaterThan(0)
    }
    expect(facetById('nonsense')).toBeNull()
  })

  it('hands the preferences back as the facet leaves them', () => {
    const prefs = { hideSoldOut: true, hideKept: true, showIgnored: false }
    expect(hidesFor(null, prefs)).toEqual({ hideIgnored: true, hideSoldOut: true, hideKept: true })
    expect(hidesFor(FACET.KEPT, prefs)).toEqual({ hideIgnored: true, hideSoldOut: true, hideKept: false })
    expect(hidesFor(FACET.IGNORED, prefs)).toEqual({ hideIgnored: false, hideSoldOut: true, hideKept: true })
  })
})
