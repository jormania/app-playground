// Two relays sharing one function (Vercel Hobby caps serverless functions at
// 12 across the whole repo, and this file wasn't Silva's own — CLAUDE.md's
// guidance at that limit is to fold a new proxy into an existing endpoint
// rather than add a file).
//
// Default (no `mode`): relays a Notion-hosted Photo file server-side so the
// browser can read its bytes as a Blob (to attach to a native share or a
// rich clipboard write). Notion's own signed file URLs
// (prod-files-secure.s3.*.amazonaws.com, *.notion-static.com) don't send
// CORS headers permitting a cross-origin `fetch()` to read the body — fine
// for the <img> tag that already renders the photo, useless for reading raw
// bytes in JS. A server-to-server fetch has no CORS restriction at all, so
// this just relays it. No Notion token needed or accepted: a signed URL is
// bearer-token-like on its own, and this only ever forwards a URL the app
// already received back from Notion — never an arbitrary one. `ALLOWED_HOSTS`
// keeps this from becoming an open proxy for fetching any URL: only Notion's
// known file-hosting domains are relayed, everything else is rejected.
//
// `mode=link-preview`: Silva's own use — given an arbitrary page URL (a Link
// thing's `link`), fetches it server-side (same CORS problem: most sites
// don't send permissive headers to a browser `fetch()`) and returns its
// Open Graph metadata as JSON, never the raw bytes. Because the URL here is
// genuinely arbitrary rather than a signed Notion URL, this branch carries
// its own guards: an SSRF hostname check, a request timeout, and a bounded
// read so a huge or slow page can't tie up the function.
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { isPrivateHost, emptyPreview, parsePreview } from './_lib/linkPreview.js'

const ALLOWED_HOSTS = [/^prod-files-secure\.s3\.[a-z0-9-]+\.amazonaws\.com$/, /(^|\.)notion-static\.com$/]
const MAX_BYTES = 8 * 1024 * 1024 // matches the client-side resize cap (photo.js) plus headroom

const MAX_HTML_BYTES = 300 * 1024 // a page's <head> is always well inside this
const FETCH_TIMEOUT_MS = 6000

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

  if (req.query?.mode === 'link-preview') {
    await handleLinkPreview(req, res)
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

async function handleLinkPreview(req, res) {
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
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    res.status(400).json({ message: 'Only http(s) links can be previewed.' })
    return
  }
  if (isPrivateHost(parsed.hostname)) {
    res.status(400).json({ message: 'That host cannot be previewed.' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstream = await fetch(parsed, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites serve a stripped page (or block outright) with no UA.
        'User-Agent': 'Mozilla/5.0 (compatible; SilvaLinkPreview/1.0; +https://coneofcold.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!upstream.ok) {
      res.status(200).json(emptyPreview(parsed))
      return
    }
    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
      res.status(200).json(emptyPreview(parsed))
      return
    }

    const html = await readBounded(upstream, MAX_HTML_BYTES)
    res.status(200).json(parsePreview(html, parsed))
  } catch {
    // A slow, unreachable, or blocking host is exactly as unremarkable as a
    // link with no preview — Silva just shows the plain link either way.
    res.status(200).json(emptyPreview(parsed))
  } finally {
    clearTimeout(timer)
  }
}

/** Reads at most `maxBytes` of the response body, then cancels the stream —
 *  a page's `<head>` sits well within this, and nothing here needs the rest
 *  of the document. */
async function readBounded(response, maxBytes) {
  const reader = response.body?.getReader()
  if (!reader) return await response.text()

  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return text
}
