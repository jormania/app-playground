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

// Given one Notion-side game row (needs `releaseStatus`, plus `tags`/
// `journal`/`developer` for the derivation decisions below) and the raw
// Steam appdetails response entry for its App ID (fetched with
// `filters=basic,price_overview,release_date,genres,developers` — `basic`
// is what makes `header_image`/`short_description` present), decides what
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
//   - Cover art is refreshed on EVERY check while still Coming Soon (not
//     just at the flip) — a still-in-development game's Steam header image
//     can go from a generic placeholder to real key art at any point, and
//     this call already has `header_image` in hand for free.
//   - Tags, journal and developer are derived from Steam (genres,
//     short_description, developers[0]) at the moment of the flip itself,
//     and ONLY when the game doesn't already have one — a Coming Soon add
//     always lands with tags/journal blank (see watchlistActions.js's
//     candidateToNewGame; developer is normally set at add-time too, but a
//     manually-created row could still be missing it), so this is what
//     turns that intentional blank into a real starting point the instant
//     there's something to fill it with, mirroring the enrichment an
//     already-released discovery add gets immediately. If the field is
//     already populated (e.g. the user hand-tagged/wrote notes on it
//     pre-release), derivation is skipped — this never overwrites a human's
//     own work. Length (hrs) is deliberately NEVER auto-derived here, at
//     flip or otherwise — HowLongToBeat almost never has real submission
//     data for a game on its actual release day, and its scrape is already
//     the most fragile integration in the app (see clickdeck-hltb.js); it
//     stays a manual/scripted backfill (Editor's FETCH HLTB, backfill-
//     hltb.py) once real data has had time to accumulate. Price is likewise
//     NOT derived here even though the appdetails call already has
//     price_overview in hand — the nightly cron already recomputes it
//     separately (resolvePriceUpdate) in the very same run for the very
//     same page, so re-deriving it here would just be redundant, and the
//     manual "Refresh Release Dates" path (no pricing pass of its own) is
//     fine leaving a fresh price to that night's cron.
export function resolveReleaseFlip(game, appData, now = new Date()) {
  if (!game || game.releaseStatus !== 'Coming Soon') return null
  if (!appData || typeof appData !== 'object' || Array.isArray(appData)) return null
  if (!appData.success) return null

  const data = appData.data
  if (!data || Array.isArray(data)) return null

  const releaseDateStr = data.release_date?.date || ''
  const comingSoon = data.release_date?.coming_soon
  const coverUrl = data.header_image || ''

  if (comingSoon !== false) {
    // Still unreleased (or Steam gave no opinion) — refresh the display
    // string/parsed year/cover only, no status transition.
    return {
      flipped: false,
      releaseDateString: releaseDateStr,
      year: parseYearFromReleaseDateString(releaseDateStr),
      coverUrl
    }
  }

  const derivedTags = (!game.tags || game.tags.length === 0) && Array.isArray(data.genres)
    ? data.genres.map(g => g.description).filter(Boolean).slice(0, 7)
    : null
  const derivedJournal = !game.journal && data.short_description ? data.short_description : null
  const derivedDeveloper = !game.developer && Array.isArray(data.developers) && data.developers[0]
    ? data.developers[0]
    : null

  return {
    flipped: true,
    releaseDateString: releaseDateStr,
    year: parseYearFromReleaseDateString(releaseDateStr),
    releasedAt: now.toISOString(),
    coverUrl,
    derivedTags,
    derivedJournal,
    derivedDeveloper
  }
}

// Builds the Notion PATCH properties for a resolved watchlist check, to be
// merged alongside (not instead of) the pricing patch for the same page —
// the nightly cron writes both in a single PATCH per page. Cover art is
// NOT a property (Notion page covers live outside `properties`) — the
// caller (api/clickdeck-pricing.js) reads `resolved.coverUrl` itself and
// sets the PATCH's top-level `cover` field alongside these.
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
  if (resolved.derivedTags) {
    properties['Tags'] = { multi_select: resolved.derivedTags.map(t => ({ name: t })) }
  }
  if (resolved.derivedJournal) {
    properties['Journal/Notes'] = { rich_text: [{ text: { content: resolved.derivedJournal } }] }
  }
  if (resolved.derivedDeveloper) {
    properties['Developer/Studio'] = { select: { name: resolved.derivedDeveloper } }
  }
  return properties
}
