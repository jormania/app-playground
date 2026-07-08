// Read/write the Wanderlist reminder prefs the daily cron consults. Prefs live in Vercel
// KV so the cron can read them while the app is closed; the app talks to this endpoint
// from Settings (see src/wanderlist/remindersConfig.js).
//
// Writes are gated by the Notion token: we only accept a change when the caller's
// x-notion-token matches the server's WANDERLIST_NOTION_TOKEN — so only the holder of
// the token (i.e. you) can set where reminders go. If KV or that token env var isn't set
// up, we answer 501 so the app can show a "finish server setup" hint instead of failing.
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { kvConfigured, kvGet, kvSet } from './_lib/kv.js'

export const PREFS_KEY = 'wanderlist:reminder-prefs'
const DEFAULTS = { enabled: false, email: '', name: '', sendHour: 8 }

function sanitize(body) {
  const b = body && typeof body === 'object' ? body : {}
  const hour = Number(b.sendHour)
  return {
    enabled: Boolean(b.enabled),
    email: String(b.email || '').trim().slice(0, 200),
    name: String(b.name || '').trim().slice(0, 100),
    sendHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 8,
  }
}

export default async function handler(req, res) {
  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }
  if (rateLimited(clientIp(req))) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  const serverToken = process.env.WANDERLIST_NOTION_TOKEN
  if (!kvConfigured() || !serverToken) {
    res.status(501).json({ configured: false, message: 'Reminders aren’t set up on the server yet (KV store + WANDERLIST_NOTION_TOKEN).' })
    return
  }

  const token = req.headers['x-notion-token']
  if (!token || token !== serverToken) {
    res.status(401).json({ message: 'Not authorised to change reminder settings.' })
    return
  }

  if (req.method === 'GET') {
    const prefs = { ...DEFAULTS, ...((await kvGet(PREFS_KEY)) || {}) }
    res.status(200).json({ configured: true, prefs })
    return
  }

  if (req.method === 'POST') {
    const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
    const prefs = sanitize(payload)
    const ok = await kvSet(PREFS_KEY, prefs)
    if (!ok) { res.status(502).json({ message: 'Could not save to the KV store.' }); return }
    res.status(200).json({ ok: true, prefs })
    return
  }

  res.status(405).json({ message: 'Use GET or POST.' })
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}
