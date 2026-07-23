// Discovery endpoint behind [W]'s "Find New Games" button. Given a list of
// followed studios, searches Steam per studio and verifies each candidate's
// actual developer/publisher fields server-side — rather than trusting a
// name-search term alone — before returning it as a real candidate. This is
// the fragile half of the Watchlist feature (see project memory
// "click-deck-watchlist-plan"): discovery is explicitly best-effort, and the
// client-side dedupe/review-modal (not this endpoint's precision) is the
// real safety net against duplicates.
//
// No Notion access here at all — the client already has its full game list
// loaded and does its own exact-appid + fuzzy-title dedupe pass locally
// (reusing steamMatch.js) after receiving these candidates. This endpoint
// only ever talks to Steam.
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { inferTagsFromSteamData, inferMatureTag } from './_lib/clickdeckTagInference.js'
import { fetchReviewSummary } from './_lib/clickdeckReviews.js'

// One search + up to PER_STUDIO_CAP one-at-a-time appdetails calls per studio,
// across the whole followed list, can run past the default serverless budget.
export const maxDuration = 300

const CONFIDENCE_THRESHOLD = 0.5

// Deliberately duplicated (not imported) from src/click-deck/lib/steamMatch.js
// — same convention as scripts/backfill-steam-ids.py mirroring that file —
// but extended with accent-stripping, which developer-name matching benefits
// from more than title matching does (the live collection already has both
// "Microïds" and "Microids" as separate values). Keep in sync if either
// normalizer's core approach changes.
function normalizeStudioName(name) {
  if (!name) return ''
  let n = name.toLowerCase()
  // Strip diacritics after NFD decomposition (e.g. i-with-diaeresis -> i +
  // combining diaeresis, then the combining mark is dropped) — the live
  // collection already has both "Microïds" and "Microids" as separate
  // values, and this is what makes them normalize to the same string.
  n = n.normalize('NFD').replace(/[̀-ͯ]/g, '')
  n = n.replace(/&/g, 'and')
  n = n.replace(/\b(games|studio|studios|entertainment|interactive|ltd|inc|llc)\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')
  return n
}

function containmentScore(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (!longer.includes(shorter)) return 0
  return shorter.length / longer.length
}

function studioMatchesCandidate(studio, candidateDevelopers, candidatePublishers) {
  const targets = [studio.name, studio.steamDeveloper].filter(Boolean).map(normalizeStudioName)
  const fields = [...(candidateDevelopers || []), ...(candidatePublishers || [])].map(normalizeStudioName)
  for (const target of targets) {
    if (!target) continue
    for (const field of fields) {
      if (containmentScore(target, field) >= CONFIDENCE_THRESHOLD) return true
    }
  }
  return false
}

function parseYearFromReleaseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}

// How many search hits to keep per studio before the (one-at-a-time,
// developer-verifying) appdetails pass. Steam returns results in relevance
// order, so a studio's own games rank at/near the top for a search of its
// name — this caps the appdetails fan-out (and thus total runtime) without
// realistically dropping the studio's actual titles.
const PER_STUDIO_CAP = 15

async function fetchSearchPage(term) {
  const url = `https://store.steampowered.com/search/?term=${encodeURIComponent(term)}&l=english&cc=US`
  const res = await fetch(url)
  if (!res.ok) return []
  const html = await res.text()

  const appIds = []
  const seen = new Set()
  const regex = /data-ds-appid="(\d+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    if (seen.has(match[1])) continue
    seen.add(match[1])
    appIds.push(match[1])
  }
  return appIds
}

async function searchSteamForStudio(name) {
  // Search with the RAW studio name, not a normalized token. Steam's
  // storesearch JSON API returns nothing at all for studio names (it's tuned
  // for game titles), which is why this scrapes the /search/ results page —
  // but normalizing the term first is actively harmful: "Wadjet Eye Games"
  // collapses to "wadjeteye", which Steam matches to zero results, whereas
  // the raw name returns ~40. Verified July 2026. The studioMatchesCandidate
  // developer check downstream is what turns this loose term search into a
  // precise "games actually BY this studio" result.
  //
  // ALSO run the term as a quoted exact phrase, in parallel, and merge.
  // An unquoted multi-word studio name gets diluted by Steam treating each
  // word independently — common words scatter matches across dozens of
  // unrelated games, and the studio's own game can miss the top-CAP results
  // entirely. Confirmed live (July 2026): Signet City by "Jump Over the Age"
  // never appeared in 5/5 unquoted searches (the studio's own developer-field
  // match on the resulting appdetails is exact — the game just never reached
  // that check because the search step upstream never surfaced it), but
  // appeared in 3/3 quoted ones. The quoted search is also tighter across the
  // board — several other followed studios (Color Gray Games, Cloak and
  // Dagger Games) drop from a noisy Steam-side 50-result ceiling down to a
  // focused ~10-15 when quoted — so quoted hits are merged in first (higher
  // signal), topped up with the broader unquoted set, deduped by appid, up to
  // the existing per-studio cap. No seed studio's quoted search came back
  // empty, so this is additive: worst case it contributes nothing and the
  // unquoted results carry the studio the same as before.
  const [quoted, raw] = await Promise.all([
    fetchSearchPage(`"${name}"`),
    fetchSearchPage(name)
  ])

  const appIds = []
  const seen = new Set()
  for (const id of [...quoted, ...raw]) {
    if (seen.has(id)) continue
    seen.add(id)
    appIds.push(id)
    if (appIds.length >= PER_STUDIO_CAP) break
  }

  return appIds.map(id => ({ id }))
}

async function fetchAppDetailsBatch(appIds) {
  const combined = {}
  for (const appId of appIds) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&filters=basic,release_date,price_overview,developers,publishers,genres`)
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.assign(combined, data)
        // Only an already-released candidate gets a review fetch here — see
        // api/_lib/clickdeckReviews.js's header comment for why a Coming
        // Soon game's review summary is guaranteed empty (this same
        // response already tells us release_date.coming_soon for free).
        const entry = data[String(appId)]
        const isComingSoon = entry?.data?.release_date?.coming_soon === true
        if (entry?.success && entry?.data && !isComingSoon) {
          entry.reviewSummary = await fetchReviewSummary(appId)
          await new Promise(r => setTimeout(r, 200))
        }
      }
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return combined
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/clickdeck-studio-search.' })
    return
  }

  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const { studios, excludeAppIds } = payload
  if (!Array.isArray(studios) || studios.length === 0) {
    res.status(400).json({ message: 'Missing studios list.' })
    return
  }

  const excludeSet = new Set((Array.isArray(excludeAppIds) ? excludeAppIds : []).map(Number))

  try {
    // Search per studio, tracking which studio each hit came from so
    // verification checks the right developer/publisher fields.
    const hitsByAppId = new Map() // appId -> studio (first match wins)
    for (const studio of studios) {
      if (!studio?.name) continue
      const items = await searchSteamForStudio(studio.name)
      for (const item of items) {
        const appId = Number(item.id)
        if (!appId || excludeSet.has(appId) || hitsByAppId.has(appId)) continue
        hitsByAppId.set(appId, studio)
      }
      await new Promise(r => setTimeout(r, 300))
    }

    const candidateAppIds = [...hitsByAppId.keys()]
    if (candidateAppIds.length === 0) {
      res.status(200).json({ candidates: [] })
      return
    }

    const details = await fetchAppDetailsBatch(candidateAppIds)

    const candidates = []
    for (const appId of candidateAppIds) {
      const entry = details[String(appId)]
      if (!entry || !entry.success || !entry.data) continue
      const data = entry.data
      const studio = hitsByAppId.get(appId)
      if (!studioMatchesCandidate(studio, data.developers, data.publishers)) continue

      if (data.type && data.type !== 'game') continue

      const isComingSoon = data.release_date?.coming_soon === true
      let releaseDateStr = data.release_date?.date || ''
      if (releaseDateStr.toLowerCase() === 'to be announced') releaseDateStr = 'TBA'
      
      if (!isComingSoon && releaseDateStr) {
        const parsedDate = new Date(releaseDateStr)
        if (!isNaN(parsedDate)) {
          const daysOld = (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)
          if (daysOld > 365 * 20) continue
        } else {
          const y = parseYearFromReleaseDateString(releaseDateStr)
          if (y && (new Date().getFullYear() - y) > 20) continue
        }
      }

      // Matched against Click Deck's own curated Tags vocabulary (genre
      // passthrough + description-text keyword matching), not a raw
      // Steam-genre-list passthrough — Steam's genres alone are broad and
      // generic (Adventure, Indie, RPG), nowhere near this collection's 5-7
      // tag policy. See api/_lib/clickdeckTagInference.js for the full
      // rationale. Mature is prioritized first (a required_age-based
      // signal, not a keyword guess) so it never gets pushed out by the cap.
      const tags = []
      const mature = inferMatureTag(data)
      if (mature) tags.push(mature)
      for (const t of inferTagsFromSteamData(data.genres, [data.short_description, data.about_the_game, data.detailed_description])) {
        if (!tags.includes(t)) tags.push(t)
      }
      const cappedTags = tags.slice(0, 7)

      candidates.push({
        appId,
        title: data.name || '',
        developer: (data.developers && data.developers[0]) || studio.name,
        matchedStudio: studio.name,
        // A plain number passed straight through from the studio the client
        // sent — see src/click-deck/lib/studios-connector.js's normalizeTier
        // for the "weighting, not enum" rationale. Null when unset.
        studioTier: typeof studio.valueTier === 'number' ? studio.valueTier : null,
        comingSoon: isComingSoon,
        releaseDateString: releaseDateStr,
        year: parseYearFromReleaseDateString(releaseDateStr),
        price: data.price_overview ? data.price_overview.final / 100 : null,
        headerImage: data.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        shortDescription: data.short_description || '',
        tags: cappedTags,
        // Only present for already-released candidates (see
        // fetchAppDetailsBatch) — left undefined, not a fake zero, for a
        // Coming Soon pick, so candidateToNewGame correctly omits these
        // fields for a title that hasn't launched yet rather than writing
        // "0 reviews" onto something never actually checked.
        steamReviewPercent: entry.reviewSummary ? entry.reviewSummary.percent : undefined,
        steamReviewDesc: entry.reviewSummary ? entry.reviewSummary.desc : undefined,
        steamReviewCount: entry.reviewSummary ? entry.reviewSummary.count : undefined,
        reviewCheckedAt: entry.reviewSummary ? new Date().toISOString() : undefined
      })
    }

    res.status(200).json({ candidates })
  } catch (err) {
    res.status(502).json({ message: `Discovery failed: ${err.message}` })
  }
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}
