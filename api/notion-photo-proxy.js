// Relays a Notion-hosted Photo file server-side so the browser can read its
// bytes as a Blob (to attach to a native share or a rich clipboard write).
// Notion's own signed file URLs (prod-files-secure.s3.*.amazonaws.com,
// *.notion-static.com) don't send CORS headers permitting a cross-origin
// `fetch()` to read the body — fine for the <img> tag that already renders
// the photo, useless for reading raw bytes in JS. A server-to-server fetch
// has no CORS restriction at all, so this just relays it.
//
// No Notion token needed or accepted: a signed URL is bearer-token-like on
// its own, and this only ever forwards a URL the app already received back
// from Notion — never an arbitrary one. `ALLOWED_HOSTS` keeps this from
// becoming an open proxy for fetching any URL: only Notion's known
// file-hosting domains are relayed, everything else is rejected.
import { originAllowed, rateLimited, clientIp } from './_shared.js'

const ALLOWED_HOSTS = [/^prod-files-secure\.s3\.[a-z0-9-]+\.amazonaws\.com$/, /(^|\.)notion-static\.com$/]
const MAX_BYTES = 8 * 1024 * 1024 // matches the client-side resize cap (photo.js) plus headroom

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/notion-photo-proxy.' })
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

  const target = req.query?.url
  if (!target || Array.isArray(target)) {
    res.status(400).json({ message: 'Missing url.' })
    return
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    res.status(400).json({ message: 'Invalid url.' })
    return
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(parsed.hostname))) {
    res.status(400).json({ message: 'That host is not an allowed Notion file host.' })
    return
  }

  try {
    const upstream = await fetch(parsed)
    if (!upstream.ok) {
      res.status(upstream.status).json({ message: 'Could not fetch that file.' })
      return
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ message: 'File is too large.' })
      return
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
    res.status(200).send(buf)
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach the file host: ${err.message}` })
  }
}
