// Orchestration for [W]'s two manual actions — kept out of the component so
// WatchlistView.jsx stays focused on rendering. Both talk to McpConnector for
// anything Notion-related (same token/write path as the rest of the app).
import { McpConnector } from './mcp-connector'
import { readReleaseStatus } from './releaseStatus'
import { resolveReleaseFlip, buildWatchlistUpdateFields } from './watchlistResolver'
import { findDuplicateInCollection } from './steamMatch'

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
    notYetReleased: candidates.filter(c => c.comingSoon),
    alreadyReleased: candidates.filter(c => !c.comingSoon)
  }
}

// Turns a chosen candidate into the game object McpConnector.addGame expects.
// Already-released candidates skip Coming Soon entirely and never get a
// Released At stamp (see api/_lib/clickdeckWatchlist.js's header comment for
// why a direct add must never pass through the flip resolver).
export function candidateToNewGame(candidate) {
  return {
    title: candidate.title,
    year: candidate.year || null,
    developer: candidate.developer || candidate.matchedStudio || '',
    tags: [],
    status: 'Backlog',
    rating: null,
    journal: candidate.shortDescription || '',
    appId: candidate.appId,
    releaseStatus: candidate.comingSoon ? 'Coming Soon' : 'Released',
    releasedAt: null,
    releaseDate: candidate.releaseDateString || ''
  }
}
