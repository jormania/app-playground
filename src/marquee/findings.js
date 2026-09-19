// What's already in Wanderlist — read back, so Marquee can stop guessing.
//
// Before this, "in Wanderlist" was a flag Marquee wrote in localStorage after a
// save it made itself. That was wrong in three directions at once: a row you
// added from Wanderlist (or from your phone) never showed, a row you deleted
// there was flagged here forever, and nothing stopped you keeping the same night
// twice. Findings is the source of truth; this module reads it and matches.
//
// Pure — no fetch, no React. The client fetches the rows; everything here is a
// function of what it returned.

/** Fold to a comparison key: diacritics stripped, case dropped, punctuation and
 *  spacing collapsed. `Marile speranțe` and `MARILE SPERANTE` are one title, and
 *  a venue's stray accent fix never breaks a match. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** A Findings row's `Place` is one string holding venue AND street AND city (see
 *  WANDERLIST.md), so venue matching is containment, not equality: "Expirat
 *  Halele Carol, Strada Doctor Constantin Istrati 1" contains "Expirat Halele
 *  Carol". Deliberately one-directional — a Place of "București" must not match
 *  every venue in the city. */
export function placeMatches(place, venue) {
  const p = fold(place)
  const v = fold(venue)
  if (!p || !v) return false
  return p.includes(v)
}

/**
 * Index the Findings rows Marquee could plausibly have created.
 *
 * Two levels, because they answer different questions:
 *   `byShowing`    venue + title + date — "is THIS night already saved?"
 *   `byProduction` venue + title        — "is this show saved at all?"
 *
 * A row's date is its Planned Date, falling back to Date Expiring: a keep writes
 * both, but a row typed by hand in Wanderlist may only carry one.
 */
export function buildFindingsIndex(findings) {
  const byShowing = new Map()
  const byProduction = new Map()

  for (const row of findings ?? []) {
    const title = fold(row.name)
    if (!title) continue
    const date = row.plannedDate || row.dateExpiring || null
    const entry = {
      id: row.id,
      name: row.name,
      place: row.place ?? null,
      date,
      attended: Boolean(row.attended),
      going: Boolean(row.going),
      url: row.url ?? null,
    }
    // Keyed by title alone at this stage; the venue is checked at lookup time,
    // because only the caller knows which venue it is asking about and `Place`
    // is a loose string rather than a venue id.
    if (!byProduction.has(title)) byProduction.set(title, [])
    byProduction.get(title).push(entry)
    if (date) {
      const key = `${title}::${date}`
      if (!byShowing.has(key)) byShowing.set(key, [])
      byShowing.get(key).push(entry)
    }
  }

  return { byShowing, byProduction, size: (findings ?? []).length }
}

export const EMPTY_INDEX = buildFindingsIndex([])

/** The Findings rows that look like this exact showing (same venue, title, date). */
export function savedShowing(index, showing) {
  if (!index || !showing?.date) return null
  const rows = index.byShowing.get(`${fold(showing.title)}::${showing.date}`) ?? []
  return rows.find((row) => placeMatches(row.place, showing.venue)) ?? null
}

/**
 * Every Findings row that looks like any date of this production.
 *
 * **Unless the venue's titles aren't names**, which is the one case where
 * matching on the title is actively wrong rather than merely loose.
 * `programme.js`'s `productionId` already knows about this: Filarmonica heads
 * every orchestral night "Concert simfonic" and every recital "Recital cameral"
 * — programme categories — so its adapter mints a `productionKey` and the
 * season's four October concerts become four cards instead of one (§9.70).
 * This function was left matching on the TITLE, which undid that downstream:
 * one kept night marked all four "in Wanderlist" (§9.86), and on a
 * single-showing card that reads as a flat, confident claim with no "1 of 4" to
 * soften it.
 *
 * A Findings row carries no `productionKey` — Wanderlist stores a name, a place
 * and a date, and nothing that could carry one — so where the title cannot
 * identify the production, the DATE has to. A row is attributed only if it falls
 * on one of this production's own dates.
 *
 * That has a cost, taken deliberately: a row with no date at all, or on a date
 * the venue has since dropped, is attributed to no concert rather than to every
 * one of them. One silent omission beats four false claims — and unlike the
 * false claim, the omission is visible the moment you open Wanderlist.
 *
 * Venues whose titles ARE names (every other one) keep the looser behaviour,
 * dateless rows included: there, a title match really is the production.
 */
export function savedForProduction(index, production) {
  if (!index || !production) return []
  const rows = index.byProduction.get(fold(production.title)) ?? []
  const here = rows.filter((row) => placeMatches(row.place, production.venue))
  if (!production.productionKey) return here
  const dates = new Set((production.showings ?? []).map((s) => s.date))
  return here.filter((row) => row.date && dates.has(row.date))
}

/**
 * Annotate productions with what Wanderlist already holds.
 *
 * `savedDates` is the set of that production's dates already kept, so the card
 * can say "1 of 3 dates" rather than implying the whole run was saved — the
 * overstatement the old per-production flag made.
 */
export function annotateSaved(productions, index) {
  return (productions ?? []).map((production) => {
    const rows = savedForProduction(index, production)
    const savedDates = new Set()
    for (const showing of production.showings) {
      if (savedShowing(index, showing)) savedDates.add(showing.date)
    }
    // Counted in DATES, not showings, because that is the unit a keep works in:
    // a Findings row carries a Planned Date, so two sittings of one production
    // on one night (Excelsior lists Tomcat at 17:00 and 20:00) are one date and
    // one possible keep. Counting showings made `savedAll` unreachable for any
    // such run — "hide what's already in Wanderlist" could never hide it, and
    // the chip read "1 of 2 dates kept" for a date that was entirely kept.
    const dates = new Set(production.showings.map((s) => s.date))
    return {
      ...production,
      savedDates,
      dateCount: dates.size,
      // A row matching the production but not any listed date still counts as
      // "you have this" — it is usually a keep for a date the venue has since
      // dropped, or one typed in Wanderlist without a date at all. Not at a
      // venue whose titles are categories rather than names: there
      // `savedForProduction` has already required the date, because nothing
      // else could tell which of four "Concert simfonic" nights a row meant.
      savedCount: rows.length,
      saved: rows.length > 0,
      savedAll: dates.size > 0 && savedDates.size === dates.size,
    }
  })
}
