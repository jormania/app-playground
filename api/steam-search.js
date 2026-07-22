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

  const { term } = req.query || {}
  if (!term || typeof term !== 'string') {
    res.status(400).json({ message: 'Missing search term.' })
    return
  }

  try {
    const steamRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`)
    const data = await steamRes.json()
    const items = data.items || []

    if (items.length === 0) {
      res.status(200).json({ items: [] })
      return
    }

    // Fetch appdetails to get the correct hashed header_image URLs
    const appIds = items.map(i => i.id).join(',')
    const detailsRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appIds}&cc=US&filters=basic`)
    const detailsData = await detailsRes.json()

    res.status(200).json({
      items: items.map(item => {
        const detail = detailsData[item.id]
        let coverUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`
        if (detail && detail.success && detail.data && detail.data.header_image) {
          coverUrl = detail.data.header_image
        }
        return {
          id: item.id,
          name: item.name,
          coverUrl
        }
      })
    })
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach Steam API: ${err.message}` })
  }
}
