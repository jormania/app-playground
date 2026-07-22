import { originAllowed, rateLimited, clientIp } from './_shared.js'

// Three modes on one endpoint, kept together deliberately — Vercel's Hobby
// plan caps a deployment at 12 serverless functions, and this repo sits
// right at that limit, so a fourth near-identical Steam-appdetails proxy
// (api/clickdeck-appdetails.js, merged in here) wasn't worth its own
// function slot. Distinguished by which query param is present:
//   ?term=      Steam storesearch by title (Editor's FETCH STEAM)
//   ?appId=     single App ID -> cover URL (Editor's FETCH STEAM, cover leg)
//   ?appids=    comma-separated App IDs -> raw appdetails map, one Steam
//               request per id with a polite delay (Watchlist's manual
//               "Refresh Release Dates" and the un-ignore recheck)
export const maxDuration = 60

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/steam-search.' })
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

  const { term, appId, appids } = req.query || {}

  try {
    if (appids && typeof appids === 'string') {
      const ids = appids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0)
      if (ids.length === 0) {
        res.status(400).json({ message: 'No valid appids provided.' })
        return
      }
      const combined = {}
      for (const id of ids) {
        const steamRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=US&filters=price_overview,release_date`)
        if (!steamRes.ok) continue
        const data = await steamRes.json()
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          Object.assign(combined, data)
        }
        // Polite delay between individual requests
        await new Promise(r => setTimeout(r, 200))
      }
      res.status(200).json(combined)
      return
    }

    if (appId && typeof appId === 'string') {
      const detailsRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&filters=basic`)
      const detailsData = await detailsRes.json()
      const detail = detailsData[appId]

      let coverUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
      if (detail && detail.success && detail.data && detail.data.header_image) {
        coverUrl = detail.data.header_image
      }

      res.status(200).json({ coverUrl })
      return
    }

    if (!term || typeof term !== 'string') {
      res.status(400).json({ message: 'Missing search term, appId or appids.' })
      return
    }

    const targetUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`
    const steamRes = await fetch(targetUrl)
    const text = await steamRes.text()

    res.status(steamRes.status)
    res.setHeader('Content-Type', 'application/json')
    res.send(text || '{}')
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach Steam API: ${err.message}` })
  }
}
