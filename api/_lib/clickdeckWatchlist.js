// Shared "did this Coming Soon game just release" resolver — used by the
// nightly pricing cron (api/clickdeck-pricing.js, widened to also fetch
// release_date) and mirrored client-side by
// src/click-deck/lib/watchlistResolver.js for the manual "Refresh Release
// Dates" button on [W]. The two copies are deliberately kept in sync the same
// way scripts/backfill-steam-ids.py mirrors steamMatch.js — see that file's
// header comment. Keep the flip RULES identical between both copies even if
// the surrounding plumbing (server env-var auth vs. client BYO-token) differs.

// Steam's release_date.date is a locale-formatted display string ("15 Jul,
// 2026", "Q3 2026", "Coming soon") — never reliably parseable to a full date,
// but a bare 4-digit year is usually extractable when Steam gives one at all.
// Returns null (not 0 or a guess) when no year is recoverable, so callers can
// tell "unknown" apart from a real year.
export function parseYearFromReleaseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}

// Given one Notion-side game row (needs `releaseStatus`) and the raw Steam
// appdetails response entry for its App ID (fetched with
// `filters=price_overview,release_date` or no filters at all), decides what
// (if anything) about its release status should change.
//
// Deliberately conservative rules — see project memory
// "click-deck-watchlist-plan" for the reasoning:
//   - Only ever considers games currently 'Coming Soon'. A game already
//     Released, or with no release status tracked, is left untouched (and a
//     game added directly as Released, e.g. an already-out title found via
//     discovery, must never be passed in with 'Coming Soon' in the first
//     place — that's what keeps Released At from ever being backfilled onto
//     an old game and falsely tripping the "just released" banner).
//   - Steam's `release_date.coming_soon === false` is the SOLE authority for
//     "has it launched" — price presence is never used as a signal (a priced
//     pre-order still reports coming_soon: true).
//   - A pull-back (coming_soon flips back to true after we already recorded
//     Released) is never auto-reverted here — left for scripts/validate-
//     watchlist.py to flag for manual review, so a flip is never silently
//     undone by a flaky/inconsistent Steam response.
//   - Released At is set ONLY on an observed transition, exactly once.
export function resolveReleaseFlip(game, appData, now = new Date()) {
  if (!game || game.releaseStatus !== 'Coming Soon') return null
  if (!appData || typeof appData !== 'object' || Array.isArray(appData)) return null
  if (!appData.success) return null

  const data = appData.data
  if (!data || Array.isArray(data)) return null

  const releaseDateStr = data.release_date?.date || ''
  const comingSoon = data.release_date?.coming_soon

  if (comingSoon !== false) {
    // Still unreleased (or Steam gave no opinion) — refresh the display
    // string/parsed year only, no status transition.
    return {
      flipped: false,
      releaseDateString: releaseDateStr,
      year: parseYearFromReleaseDateString(releaseDateStr)
    }
  }

  return {
    flipped: true,
    releaseDateString: releaseDateStr,
    year: parseYearFromReleaseDateString(releaseDateStr),
    releasedAt: now.toISOString()
  }
}

// Builds the Notion PATCH properties for a resolved watchlist check, to be
// merged alongside (not instead of) the pricing patch for the same page —
// the nightly cron writes both in a single PATCH per page.
export function buildWatchlistPatchProperties(resolved) {
  const properties = {
    'Release Date': { rich_text: resolved.releaseDateString ? [{ text: { content: resolved.releaseDateString } }] : [] }
  }
  if (resolved.year !== null && resolved.year !== undefined) {
    properties['Release Year'] = { number: resolved.year }
  }
  if (resolved.flipped) {
    properties['Release Status'] = { select: { name: 'Released' } }
    properties['Released At'] = { date: { start: resolved.releasedAt } }
  }
  return properties
}
