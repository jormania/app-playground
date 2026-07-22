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

async function searchSteamForStudio(name) {
  const searchTerm = normalizeStudioName(name) || name;
  const url = `https://store.steampowered.com/search/?term=${encodeURIComponent(searchTerm)}&l=english&cc=US`
  const res = await fetch(url)
  if (!res.ok) return []
  const html = await res.text()
  
  const appIds = new Set()
  const regex = /data-ds-appid="(\d+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    appIds.add(match[1])
  }
  
  return Array.from(appIds).map(id => ({ id }))
}

async function fetchAppDetailsBatch(appIds) {
  const combined = {}
  for (const appId of appIds) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&filters=basic,release_date,price_overview,developers,publishers,genres`)
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object' && !Array.isArray(data)) Object.assign(combined, data)
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
          if (daysOld > 365) continue
        } else {
          const y = parseYearFromReleaseDateString(releaseDateStr)
          if (y && (new Date().getFullYear() - y) > 1) continue
        }
      }

      let tags = []
      if (data.genres && Array.isArray(data.genres)) {
        tags = data.genres.map(g => g.description).filter(Boolean)
      }

      candidates.push({
        appId,
        title: data.name || '',
        developer: (data.developers && data.developers[0]) || studio.name,
        matchedStudio: studio.name,
        comingSoon: isComingSoon,
        releaseDateString: releaseDateStr,
        year: parseYearFromReleaseDateString(releaseDateStr),
        price: data.price_overview ? data.price_overview.final / 100 : null,
        headerImage: data.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        shortDescription: data.short_description || '',
        tags
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
