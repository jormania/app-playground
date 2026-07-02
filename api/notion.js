// Vercel serverless proxy — the one server-side piece in this otherwise static
// playground. It exists for exactly two reasons the browser can't solve itself:
//   1. CORS — api.notion.com refuses cross-origin browser requests outright.
//   2. Reachability — the call has to originate server-side to be allowed at all.
//
// It is deliberately a thin, STATELESS relay: it stores no secret. The Notion
// token is supplied per-request by the client (BYO model, like Touch Grass's
// Anthropic key) in the `x-notion-token` header, and is relayed as
// `Authorization: Bearer`. Nothing is logged or persisted here.
import { NOTION_BASE, originAllowed, rateLimited, clientIp } from './_shared.js'

// Classic, long-stable version: lets the app query `databases/{id}/query` and
// create pages with `parent.database_id`, so users only need a database URL.
const NOTION_VERSION = '2022-06-28'
// The file upload feature (file_uploads endpoints, and referencing an uploaded
// file from a page property) postdates the classic version above. Callers that
// need it pass `version` explicitly; everything else stays pinned to the classic
// version so existing query/create/update behaviour never shifts underfoot.
const NOTION_FILES_VERSION = '2025-09-03'
const ALLOWED_VERSIONS = new Set([NOTION_VERSION, NOTION_FILES_VERSION])
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/notion.' })
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

  const token = req.headers['x-notion-token']
  if (!token) {
    res.status(401).json({ message: 'Missing Notion token. Add it in the app settings.' })
    return
  }

  // Vercel parses JSON bodies automatically; guard for the raw-string case too.
  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const { path, method = 'POST', body, version } = payload

  if (!path || typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
    res.status(400).json({ message: 'Invalid Notion path.' })
    return
  }
  const upperMethod = String(method).toUpperCase()
  if (!ALLOWED_METHODS.has(upperMethod)) {
    res.status(400).json({ message: `Method ${method} not allowed.` })
    return
  }
  const notionVersion = ALLOWED_VERSIONS.has(version) ? version : NOTION_VERSION

  try {
    const notionRes = await fetch(NOTION_BASE + path, {
      method: upperMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': notionVersion,
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
