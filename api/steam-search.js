import { originAllowed, rateLimited, clientIp } from './_shared.js'

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

  const { term, appId } = req.query || {}

  try {
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
      res.status(400).json({ message: 'Missing search term or appId.' })
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
