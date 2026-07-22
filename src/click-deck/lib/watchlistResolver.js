// Client-side twin of api/_lib/clickdeckWatchlist.js, used by the manual
// "Refresh Release Dates" action on [W]. Deliberately duplicated rather than
// imported across the api/ <-> src/ boundary (same convention as
// scripts/backfill-steam-ids.py mirroring steamMatch.js) — keep the flip
// RULES identical between the two copies if either changes. The shapes
// differ on purpose: this one returns plain game-field updates (merged into
// a game object before calling McpConnector.updateGame), since the server
// copy returns raw Notion PATCH properties instead.

export function parseYearFromReleaseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}

// See api/_lib/clickdeckWatchlist.js's resolveReleaseFlip for the full
// rationale behind these rules — kept identical here, including the cover-
// refresh-every-check / tags-derived-only-on-flip-and-only-if-empty split.
export function resolveReleaseFlip(game, appData, now = new Date()) {
  if (!game || game.releaseStatus !== 'Coming Soon') return null
  if (!appData || typeof appData !== 'object' || Array.isArray(appData)) return null
  if (!appData.success) return null

  const data = appData.data
  if (!data || Array.isArray(data)) return null

  let releaseDateStr = data.release_date?.date || ''
  if (releaseDateStr.toLowerCase() === 'to be announced') releaseDateStr = 'TBA'
  const comingSoon = data.release_date?.coming_soon
  const coverUrl = data.header_image || ''

  if (comingSoon !== false) {
    return {
      flipped: false,
      releaseDateString: releaseDateStr,
      year: parseYearFromReleaseDateString(releaseDateStr),
      checkedAt: now.toISOString(),
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
    checkedAt: now.toISOString(),
    coverUrl,
    derivedTags,
    derivedJournal,
    derivedDeveloper
  }
}

// Turns a resolved flip into the partial game-object fields to merge in
// before calling McpConnector.updateGame(id, { ...game, ...fields }). Note:
// coverUrl here only updates the local/optimistic game object — the caller
// must ALSO call McpConnector.updateGameCover separately, since Notion page
// covers PATCH through a dedicated endpoint, not the properties write
// updateGame sends (see watchlistActions.js's refreshComingSoonGames).
export function buildWatchlistUpdateFields(resolved) {
  const fields = {
    releaseDate: resolved.releaseDateString,
    priceUpdatedAt: resolved.checkedAt
  }
  if (resolved.year !== null && resolved.year !== undefined) fields.year = resolved.year
  if (resolved.coverUrl) fields.coverUrl = resolved.coverUrl
  if (resolved.flipped) {
    fields.releaseStatus = 'Released'
    fields.releasedAt = resolved.releasedAt
  }
  if (resolved.derivedTags) fields.tags = resolved.derivedTags
  if (resolved.derivedJournal) fields.journal = resolved.derivedJournal
  if (resolved.derivedDeveloper) fields.developer = resolved.derivedDeveloper
  return fields
}
