// Sends photo bytes to a Notion file upload. Split out from notion.js because this
// one Notion call is the sole exception to "everything is JSON": Notion requires
// `multipart/form-data` for `/file_uploads/{id}/send` (see its docs — "unique to
// this endpoint"). Vercel's default body parser only handles JSON/text/form-encoded,
// so we disable it here and read the raw photo bytes ourselves, then re-wrap them
// as the multipart form Notion expects. Same stateless BYO-token model as notion.js.
import { NOTION_BASE, originAllowed, rateLimited, clientIp } from './_shared.js'

const NOTION_FILES_VERSION = '2025-09-03'
// Comfortably above what the client-side resize (photo.js, capped ~1600px JPEG)
// ever produces, well under Notion's 20MB single-part limit — just a sanity guard.
const MAX_BYTES = 8 * 1024 * 1024
const UPLOAD_ID_RE = /^[a-z0-9-]{10,80}$/i

export const config = { api: { bodyParser: false } }

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/notion-upload.' })
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

  const uploadId = req.query?.id
  if (!uploadId || Array.isArray(uploadId) || !UPLOAD_ID_RE.test(uploadId)) {
    res.status(400).json({ message: 'Missing or invalid file upload id.' })
    return
  }

  let filename = 'photo.jpg'
  try { filename = decodeURIComponent(req.headers['x-filename'] || filename) } catch { /* keep default */ }
  const contentType = req.headers['content-type'] || 'application/octet-stream'

  const bytes = await readRawBody(req)
  if (!bytes.length) {
    res.status(400).json({ message: 'Empty upload.' })
    return
  }
  if (bytes.length > MAX_BYTES) {
    res.status(413).json({ message: 'Photo is too large.' })
    return
  }

  try {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: contentType }), filename)
    const notionRes = await fetch(`${NOTION_BASE}file_uploads/${uploadId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_FILES_VERSION },
      body: form,
    })
    const text = await notionRes.text()
    res.status(notionRes.status)
    res.setHeader('Content-Type', 'application/json')
    res.send(text || '{}')
  } catch (err) {
    res.status(502).json({ message: `Proxy could not reach Notion: ${err.message}` })
  }
}
