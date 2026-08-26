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

/** Every Findings row that looks like any date of this production. */
export function savedForProduction(index, production) {
  if (!index || !production) return []
  const rows = index.byProduction.get(fold(production.title)) ?? []
  return rows.filter((row) => placeMatches(row.place, production.venue))
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
    return {
      ...production,
      savedDates,
      // A row matching the production but not any listed date still counts as
      // "you have this" — it is usually a keep for a date the venue has since
      // dropped, or one typed in Wanderlist without a date at all.
      savedCount: rows.length,
      saved: rows.length > 0,
      savedAll: production.showings.length > 0 && savedDates.size === production.showings.length,
    }
  })
}
