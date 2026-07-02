// Vercel serverless proxy — the one server-side piece in this otherwise static
// playground. It exists for exactly two reasons the browser can't solve itself:
//   1. CORS — api.notion.com refuses cross-origin browser requests outright.
//   2. Reachability — the call has to originate server-side to be allowed at all.
//
// It is deliberately a thin, STATELESS relay: it stores no secret. The Notion
// token is supplied per-request by the client (BYO model, like Touch Grass's
// Anthropic key) in the `x-notion-token` header, and is relayed as
// `Authorization: Bearer`. Nothing is logged or persisted here.

const NOTION_BASE = 'https://api.notion.com/v1/'
// Classic, long-stable version: lets the app query `databases/{id}/query` and
// create pages with `parent.database_id`, so users only need a database URL.
const NOTION_VERSION = '2022-06-28'
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH'])

// The relay is stateless and holds no secret, but it's still a live CORS-bypass to api.notion.com
// with whatever token the caller supplies — an open one lets any third-party page use it as a free
// proxy for someone else's Notion token. Two lightweight, additive guards close that off without
// requiring any server-side state or secret:
//   1. Origin allowlist — a real browser request always carries an Origin header naming the page
//      that made it; a request from anywhere but our own deployed origins is rejected. Requests
//      with no Origin header (curl, server-to-server, some same-origin edge cases) are allowed
//      through, since the abuse vector is specifically cross-site pages, which always send one.
//   2. Per-IP rate limit — a small in-memory token bucket. Best-effort only (resets on cold start,
//      not shared across instances) but enough to blunt casual abuse of a single-user app's quota.
const ALLOWED_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*coneofcold\.vercel\.app$/, /^https?:\/\/localhost(:\d+)?$/]

function originAllowed(origin) {
  if (!origin) return true
  return ALLOWED_ORIGINS.some((re) => re.test(origin))
}

const RATE_LIMIT = 20 // requests
const RATE_WINDOW_MS = 10_000 // per 10s per IP — generous for one user's real usage
const hits = new Map() // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  // Prevent unbounded growth across many distinct IPs on a long-lived warm instance.
  if (hits.size > 500) hits.clear()
  return recent.length > RATE_LIMIT
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/notion.' })
    return
  }

  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (rateLimited(ip)) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  const token = req.headers['x-notion-token']
  if (!token) {
    res.status(401).json({ message: 'Missing Notion token. Add it in the app settings.' })
    return
  }

  // Vercel parses JSON bodies automatically; guard for the raw-string case too.
  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const { path, method = 'POST', body } = payload

  if (!path || typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
    res.status(400).json({ message: 'Invalid Notion path.' })
    return
  }
  const upperMethod = String(method).toUpperCase()
  if (!ALLOWED_METHODS.has(upperMethod)) {
    res.status(400).json({ message: `Method ${method} not allowed.` })
    return
  }

  try {
    const notionRes = await fetch(NOTION_BASE + path, {
      method: upperMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: upperMethod === 'GET' || body == null ? undefined : JSON.stringify(body),
    })
    const text = await notionRes.text()
    res.status(notionRes.status)
    res.setHeader('Content-Type', 'application/json')
    res.send(text || '{}')
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach Notion: ${err.message}` })
  }
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}
