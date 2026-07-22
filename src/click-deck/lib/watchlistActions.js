// Orchestration for [W]'s two manual actions — kept out of the component so
// WatchlistView.jsx stays focused on rendering. Both talk to McpConnector for
// anything Notion-related (same token/write path as the rest of the app).
import { McpConnector } from './mcp-connector'
import { readReleaseStatus, isIgnored } from './releaseStatus'
import { resolveReleaseFlip, buildWatchlistUpdateFields, parseYearFromReleaseDateString } from './watchlistResolver'
import { findDuplicateInCollection } from './steamMatch'
import { DEFAULT_TIER_WEIGHT } from './studios-connector'

// Curated-not-chronological ordering for New Candidates: a Tier 3 ("automatic
// follow") studio's game should always sit above a Tier 1 one, full stop —
// only within the same tier does release timing decide order. `dir` flips
// the date comparison so "not yet released" reads soonest-first while
// "already released" reads most-recent-first, without duplicating the
// tier-comparison half of the logic.
function compareCandidates(a, b, dir = 1) {
  const tierA = typeof a.studioTier === 'number' ? a.studioTier : DEFAULT_TIER_WEIGHT
  const tierB = typeof b.studioTier === 'number' ? b.studioTier : DEFAULT_TIER_WEIGHT
  if (tierA !== tierB) return tierB - tierA
  const yearA = a.year || (dir === 1 ? Infinity : -Infinity)
  const yearB = b.year || (dir === 1 ? Infinity : -Infinity)
  if (yearA !== yearB) return dir * (yearA - yearB)
  const dateA = a.releaseDateString || ''
  const dateB = b.releaseDateString || ''
  return dir * dateA.localeCompare(dateB)
}

// "Refresh Release Dates" — re-checks every Coming Soon game against Steam,
// applies any flips through the normal McpConnector.updateGame path (so it
// gets the same Notion write behaviour as any other edit), and returns a
// summary for the calling toast/UI.
export async function refreshComingSoonGames(games) {
  const comingSoon = games.filter(g => readReleaseStatus(g) === 'Coming Soon' && g.appId)
  if (comingSoon.length === 0) return { checked: 0, flipped: [], updated: [] }

  const appIds = comingSoon.map(g => g.appId)
  const res = await fetch(`/api/clickdeck-appdetails?appids=${appIds.join(',')}`)
  if (!res.ok) throw new Error('Could not reach Steam to refresh release dates.')
  const steamData = await res.json()

  const flipped = []
  const updated = []
  for (const game of comingSoon) {
    const resolved = resolveReleaseFlip(game, steamData[String(game.appId)])
    if (!resolved) continue
    const fields = buildWatchlistUpdateFields(resolved)
    const nextGame = { ...game, ...fields }
    await McpConnector.updateGame(game.id, nextGame)
    updated.push(nextGame)
    if (resolved.flipped) flipped.push(nextGame)
  }

  return { checked: comingSoon.length, flipped, updated }
}

// "Find New Games" — searches followed studios via the discovery proxy, then
// runs the two-tier dedupe locally against the full collection (the server
// only did the cheap exact-appid pre-filter). Splits results into
// not-yet-released vs already-released-but-uncollected, per the design.
export async function searchFollowedStudios(studios, games) {
  const excludeAppIds = games.filter(g => g.appId).map(g => g.appId)

  const res = await fetch('/api/clickdeck-studio-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studios, excludeAppIds })
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'Studio search failed.')
  }
  const data = await res.json()
  const candidates = (data.candidates || []).map(c => ({
    ...c,
    duplicate: findDuplicateInCollection(c, games)
  }))

  return {
    notYetReleased: candidates.filter(c => c.comingSoon).sort((a, b) => compareCandidates(a, b, 1)),
    alreadyReleased: candidates.filter(c => !c.comingSoon).sort((a, b) => compareCandidates(a, b, -1))
  }
}

// Turns a chosen candidate into the game object McpConnector.addGame expects.
// Already-released candidates skip Coming Soon entirely and never get a
// Released At stamp (see api/_lib/clickdeckWatchlist.js's header comment for
// why a direct add must never pass through the flip resolver).
//
// Enrichment from the discovery search (tags from Steam genres, a description,
// price/cover) is applied ONLY to already-released titles. A Coming Soon add
// deliberately lands with empty tags and journal — you can't meaningfully tag
// or review a game you haven't played, that's what the collection's 5-7 tag
// policy is for, and it's what keeps the one-time "just released — add tags &
// notes?" nudge (fired when it later flips) an honest prompt rather than a
// no-op on top of pre-filled Steam marketing copy.
export function candidateToNewGame(candidate) {
  const enrich = !candidate.comingSoon
  return {
    title: candidate.title,
    year: candidate.year || null,
    developer: candidate.developer || candidate.matchedStudio || '',
    tags: enrich ? (candidate.tags || []).slice(0, 7) : [],
    status: 'Backlog',
    rating: null,
    journal: enrich ? (candidate.shortDescription || '') : '',
    appId: candidate.appId,
    releaseStatus: candidate.comingSoon ? 'Coming Soon' : 'Released',
    releasedAt: null,
    releaseDate: candidate.releaseDateString || '',
    coverUrl: candidate.headerImage || '',
    // Pre-order prices exist for some Coming Soon titles; recording them is
    // harmless (Coming Soon games are excluded from Stats/value anyway) and
    // the nightly cron corrects initial-vs-sale price the same night.
    price: candidate.price,
    initialPrice: candidate.price,
    discountPercent: 0
  }
}

// "− IGNORE" on a New Candidates row. Deliberately still a real DB row (not
// just a client-side dismissal) — that's what makes an ignored game persist
// across sessions/devices, stay out of future "Find New Games" results via
// the existing appId-exclude + fuzzy-title dedupe (it's just another row in
// the collection as far as both checks are concerned), and be exportable so
// "what did I ignore" has an actual answer. No tags/journal/price enrichment
// bother — none of it is ever shown while a game sits Ignored.
export function candidateToIgnoredGame(candidate) {
  return {
    title: candidate.title,
    year: candidate.year || null,
    developer: candidate.developer || candidate.matchedStudio || '',
    tags: [],
    status: 'Backlog',
    rating: null,
    journal: '',
    appId: candidate.appId,
    releaseStatus: 'Ignored',
    releasedAt: null,
    releaseDate: candidate.releaseDateString || '',
    coverUrl: candidate.headerImage || '',
    price: null,
    initialPrice: null,
    discountPercent: 0
  }
}

// Un-ignore: re-checks Steam (an ignored row may be old — the game could
// have released, delayed further, or changed price since) and restores it to
// Coming Soon or Released accordingly, refreshing its display fields in the
// same pass. Mirrors candidateToNewGame's rule: assigning Released directly
// here is a status correction, not an observed Coming-Soon transition, so
// Released At is never stamped — only the resolver's own flip path does that.
export async function unignoreGame(game) {
  if (!game.appId) throw new Error('This game has no Steam App ID to re-check.')
  const res = await fetch(`/api/clickdeck-appdetails?appids=${game.appId}`)
  if (!res.ok) throw new Error('Could not reach Steam to re-check this game.')
  const steamData = await res.json()
  const entry = steamData[String(game.appId)]
  if (!entry || !entry.success || !entry.data) {
    throw new Error('Steam has no current data for this App ID — try again later.')
  }
  const data = entry.data
  const comingSoon = data.release_date?.coming_soon === true
  const releaseDateStr = data.release_date?.date || ''
  const fields = {
    releaseStatus: comingSoon ? 'Coming Soon' : 'Released',
    releasedAt: null,
    releaseDate: releaseDateStr,
    year: parseYearFromReleaseDateString(releaseDateStr) || game.year,
    coverUrl: data.header_image || game.coverUrl,
    price: data.price_overview ? data.price_overview.final / 100 : null,
    initialPrice: data.price_overview ? data.price_overview.initial / 100 : null,
    discountPercent: data.price_overview ? (data.price_overview.discount_percent || 0) / 100 : 0
  }
  const nextGame = { ...game, ...fields }
  await McpConnector.updateGame(game.id, nextGame)
  return nextGame
}

// The exportable "what did I ignore" list — see [W]'s IGNORED section.
export function getIgnoredGames(games) {
  return games.filter(isIgnored)
}
