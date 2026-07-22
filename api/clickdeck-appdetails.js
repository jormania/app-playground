// Thin Steam appdetails proxy, purely for the client-side "Refresh Release
// Dates" action on [W] — mirrors api/steam-search.js's shape (no secrets, no
// Notion involvement, just a CORS/reachability relay to Steam). Chunks
// internally so the client can pass an arbitrary number of App IDs in one
// call rather than managing Steam's practical per-request limit itself.
import { originAllowed, rateLimited, clientIp } from './_shared.js'


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/clickdeck-appdetails.' })
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

  const { appids } = req.query || {}
  if (!appids || typeof appids !== 'string') {
    res.status(400).json({ message: 'Missing appids (comma-separated).' })
    return
  }

  const ids = appids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0)
  if (ids.length === 0) {
    res.status(400).json({ message: 'No valid appids provided.' })
    return
  }

  const combined = {}
  try {
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
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach Steam API: ${err.message}` })
  }
}
