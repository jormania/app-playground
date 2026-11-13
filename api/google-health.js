// Google Health (Fitbit) — the one server function behind three things:
//   · Yoru's and Touch Grass's readings (sleep after a wind-down, a walk's steps),
//   · the Claude connector (MCP) that answers questions about the same data,
//   · the one-time Google consent that makes both possible.
// One function, not three, because Vercel Hobby caps the repo at twelve (DEPLOY.md).
// GOOGLE_HEALTH.md has the setup and the reasoning; this header is the map.
//
// Routes, by `?mode=`:
//   connect     POST (form: key)  → 303 to Google's consent screen
//   callback    GET  (code, state) → stores the refresh token in KV, back to the page
//                 (Google calls /api/google-health/callback — vercel.json rewrites it)
//   status      GET                → { configured, connected, connectedAt, lostAt }
//   disconnect  POST               → revokes at Google and forgets the token
//   sleep       GET  from, to      → nights (YYYY-MM-DD wake-up dates, ≤ 90 days)
//   window      GET  start, end    → steps / distance / floors / heart for ≤ 24 h
//   daily       GET  from, to      → one row per day
//   mcp         POST (JSON-RPC)    → the connector (/api/health-mcp/<key> rewrites here)
//
// Auth: the app modes need `x-health-key: GOOGLE_HEALTH_APP_KEY`; MCP needs the
// path key GOOGLE_HEALTH_MCP_KEY; `connect` takes the app key from the form so it
// never sits in a URL. The callback is protected by its signed `state`.
//
// Nothing health-related is stored server-side. Every reading is fetched from
// Google on request and passed straight through with `Cache-Control: no-store`.
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { kvConfigured, kvGet } from './_lib/kv.js'
import { keyMatches, makeState, stateValid } from './_lib/googleHealth/auth.js'
import { AUTH_KEY, oauthConfigured, authorizeUrl, exchangeCode, disconnect, HealthError } from './_lib/googleHealth/client.js'
import { getSleep, getWindow, getDaily } from './_lib/googleHealth/queries.js'
import { handleMcpMessage } from './_lib/googleHealth/mcp.js'

export const config = { maxDuration: 30 }

const PAGE = '/google-health.html'

function back(res, params) {
  res.setHeader('Location', `${PAGE}?${new URLSearchParams(params)}`)
  res.status(303).end()
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch {
      return Object.fromEntries(new URLSearchParams(req.body))
    }
  }
  return req.body || {}
}

function fail(res, err) {
  if (err instanceof HealthError) {
    res.status(err.status).json({ message: err.message, code: err.code })
    return
  }
  res.status(500).json({ message: `Unexpected error: ${err && err.message}`, code: 'internal' })
}

async function handleMcp(req, res) {
  if (!keyMatches(req.query.key, process.env.GOOGLE_HEALTH_MCP_KEY)) {
    res.status(404).json({ message: 'Not found.' })
    return
  }
  if (req.method !== 'POST') {
    // Stateless server: no SSE stream to open, no session to delete.
    res.setHeader('Allow', 'POST')
    res.status(405).json({ message: 'Use POST.' })
    return
  }
  const msg = parseBody(req)
  const answer = await handleMcpMessage(msg)
  if (answer === null) {
    res.status(202).end()
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(answer)
}

async function handleCallback(req, res) {
  const { code, state, error } = req.query
  if (error) return back(res, { error: 'denied' })
  if (!stateValid(state, process.env.GOOGLE_HEALTH_APP_KEY)) return back(res, { error: 'state' })
  if (!code) return back(res, { error: 'code' })
  try {
    await exchangeCode(code)
    return back(res, { connected: '1' })
  } catch (err) {
    return back(res, { error: 'exchange', detail: String(err.message || '').slice(0, 200) })
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const mode = String(req.query.mode || '')

  if (mode === 'mcp') return handleMcp(req, res)
  if (mode === 'callback') return handleCallback(req, res)

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  if (mode === 'connect') {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Use the Connect button on /google-health.html.' })
      return
    }
    if (!oauthConfigured() || !kvConfigured()) return back(res, { error: 'config' })
    const { key } = parseBody(req)
    if (!keyMatches(key, process.env.GOOGLE_HEALTH_APP_KEY)) return back(res, { error: 'key' })
    res.setHeader('Location', authorizeUrl(makeState(process.env.GOOGLE_HEALTH_APP_KEY)))
    res.status(303).end()
    return
  }

  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }
  if (!keyMatches(req.headers['x-health-key'], process.env.GOOGLE_HEALTH_APP_KEY)) {
    res.status(401).json({ message: 'Missing or wrong health key. Set it on /google-health.html.', code: 'key' })
    return
  }

  try {
    switch (mode) {
      case 'status': {
        const auth = kvConfigured() ? await kvGet(AUTH_KEY) : null
        res.status(200).json({
          configured: oauthConfigured() && kvConfigured(),
          connected: Boolean(auth && auth.refreshToken),
          connectedAt: (auth && auth.connectedAt) || null,
          lostAt: (auth && auth.lostAt) || null,
        })
        return
      }
      case 'disconnect':
        if (req.method !== 'POST') { res.status(405).json({ message: 'Use POST.' }); return }
        await disconnect()
        res.status(200).json({ connected: false })
        return
      case 'sleep':
        res.status(200).json({ nights: await getSleep(String(req.query.from || ''), String(req.query.to || '')) })
        return
      case 'window':
        res.status(200).json(await getWindow(String(req.query.start || ''), String(req.query.end || '')))
        return
      case 'daily':
        res.status(200).json({ days: await getDaily(String(req.query.from || ''), String(req.query.to || '')) })
        return
      default:
        res.status(400).json({ message: 'Unknown mode.' })
    }
  } catch (err) {
    fail(res, err)
  }
}
