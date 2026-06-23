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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/notion.' })
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
