import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { CHANNEL_ID_RE, HttpError, checkAvailable, parseIds, readChannelPage, validPageToken } from './_lib/youtube.js'

// Stillflow's "Check for updates" and "Import the whole channel": one page of a
// YouTube channel's uploads per call, so each call stays short and the app can
// show progress and stop early. See api/_lib/youtube.js for the two sources.
//
//   GET /api/youtube-channel?channel=UC…&pageToken=…
//   → { source: 'api' | 'rss', videos: [...], nextPageToken, total }
//   GET /api/youtube-channel?ids=a,b,c (≤ 50)
//   → { checked: [...], available: [...] }   which videos still play (needs the key)
//
// YOUTUBE_API_KEY (optional, Vercel env var) unlocks the full channel with
// durations. Without it the app still works; it just sees the 15 newest uploads.
export const maxDuration = 30

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/youtube-channel.' })
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

  const { channel, pageToken, ids } = req.query || {}
  if (ids !== undefined) {
    const list = parseIds(ids)
    if (!list) {
      res.status(400).json({ message: 'ids must be 1–50 YouTube video ids, comma-separated.' })
      return
    }
    try {
      const out = await checkAvailable({ ids: list, apiKey: process.env.YOUTUBE_API_KEY })
      res.setHeader('Cache-Control', 's-maxage=3600')
      res.status(200).json(out)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 502
      res.status(status).json({ message: err instanceof HttpError ? err.message : `Could not reach YouTube: ${err.message}` })
    }
    return
  }
  if (typeof channel !== 'string' || !CHANNEL_ID_RE.test(channel)) {
    res.status(400).json({ message: 'Missing or malformed channel id.' })
    return
  }
  if (!validPageToken(pageToken)) {
    res.status(400).json({ message: 'Malformed page token.' })
    return
  }

  try {
    const page = await readChannelPage({ channelId: channel, pageToken: pageToken || undefined, apiKey: process.env.YOUTUBE_API_KEY })
    // Short shared cache: a second check within minutes costs YouTube nothing.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60')
    res.status(200).json(page)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 502
    res.status(status).json({ message: err instanceof HttpError ? err.message : `Could not reach YouTube: ${err.message}` })
  }
}
