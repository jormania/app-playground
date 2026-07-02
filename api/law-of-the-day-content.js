// Public read-only proxy in front of the Vercel Blob store the cron
// function (generate-law-of-the-day.js) writes to. Kept as a proxy rather
// than having the client fetch the Blob store's own domain directly, so no
// specific store hostname ever needs to be baked into client code.
import { head } from '@vercel/blob'
import { originAllowed, rateLimited, clientIp } from './_shared.js'

const BLOB_PATH_PREFIX = 'law-of-the-day'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET.' })
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

  // Parse the query string from req.url directly rather than relying on
  // Vercel's req.query convenience property, which the plain Node request
  // object under the Vite dev relay doesn't have.
  const { searchParams } = new URL(req.url, 'http://localhost')
  const lawId = Number(searchParams.get('lawId'))
  if (!Number.isInteger(lawId) || lawId < 1 || lawId > 48) {
    res.status(400).json({ message: 'lawId must be an integer 1-48.' })
    return
  }

  try {
    const meta = await head(`${BLOB_PATH_PREFIX}/${lawId}.json`)
    const blobRes = await fetch(meta.url)
    if (!blobRes.ok) throw new Error(`Blob fetch failed: ${blobRes.status}`)
    const text = await blobRes.text()
    res.status(200)
    res.setHeader('Content-Type', 'application/json')
    res.send(text)
  } catch (_err) {
    res.status(404).json({ message: 'No generated content for this law yet.' })
  }
}
