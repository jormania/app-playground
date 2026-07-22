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
