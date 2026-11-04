// api/google-health.js routes eight modes through one function (DEPLOY.md: the
// twelve-function cap). What can silently break is the gating between them — an
// app mode answering without the key, the MCP path answering the wrong key, the
// callback accepting a state it did not issue — so that is what this pins, plus
// one full read through the token refresh to the Health API.
// Lives in api/_tests/ because a test file directly in api/ is a function too.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const kv = vi.hoisted(() => ({ store: new Map(), configured: true }))

vi.mock('../_lib/kv.js', () => ({
  kvConfigured: () => kv.configured,
  kvGet: async (key) => kv.store.get(key) ?? null,
  kvSet: async (key, value) => { kv.store.set(key, value); return true },
}))

vi.mock('../_shared.js', async (importOriginal) => ({
  ...(await importOriginal()),
  originAllowed: (o) => !o || o === 'https://coneofcold.vercel.app',
  rateLimited: () => false,
}))

const { default: handler } = await import('../google-health.js')
const { makeState } = await import('../_lib/googleHealth/auth.js')
const { AUTH_KEY, resetTokenCache } = await import('../_lib/googleHealth/client.js')

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.send = (text) => { res.body = text; return res }
  res.end = () => res
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
  return res
}

async function call({ query = {}, method = 'GET', headers = {}, body } = {}) {
  const res = makeRes()
  await handler({ query, method, headers, body, socket: {} }, res)
  return res
}

const APP = 'app-key-123'
const MCP = 'mcp-key-456'

let env
let fetchMock
beforeEach(() => {
  env = { ...process.env }
  kv.store = new Map()
  kv.configured = true
  process.env.GOOGLE_HEALTH_APP_KEY = APP
  process.env.GOOGLE_HEALTH_MCP_KEY = MCP
  process.env.GOOGLE_HEALTH_CLIENT_ID = 'cid'
  process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'csecret'
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  process.env = env
  vi.unstubAllGlobals()
})

const json = (status, data) => ({ ok: status < 400, status, json: async () => data })

describe('app modes', () => {
  it('refuse a missing or wrong key', async () => {
    expect((await call({ query: { mode: 'status' } })).statusCode).toBe(401)
    expect((await call({ query: { mode: 'status' }, headers: { 'x-health-key': 'nope' } })).statusCode).toBe(401)
  })

  it('refuse a foreign origin even with the key', async () => {
    const r = await call({ query: { mode: 'status' }, headers: { 'x-health-key': APP, origin: 'https://evil.example' } })
    expect(r.statusCode).toBe(403)
  })

  it('report status without leaking the token', async () => {
    kv.store.set(AUTH_KEY, { refreshToken: 'rt', connectedAt: '2026-11-04T10:00:00Z' })
    const r = await call({ query: { mode: 'status' }, headers: { 'x-health-key': APP } })
    expect(r.body).toEqual({ configured: true, connected: true, connectedAt: '2026-11-04T10:00:00Z', lostAt: null })
    expect(r.headers['cache-control']).toBe('no-store')
  })

  it('say "not connected" with 409 before any consent', async () => {
    const r = await call({ query: { mode: 'sleep', from: '2026-11-01', to: '2026-11-04' }, headers: { 'x-health-key': APP } })
    expect(r.statusCode).toBe(409)
    expect(r.body.code).toBe('not_connected')
  })

  it('validate dates before calling Google', async () => {
    kv.store.set(AUTH_KEY, { refreshToken: 'rt' })
    const r = await call({ query: { mode: 'daily', from: '2026-01-01', to: '2026-11-04' }, headers: { 'x-health-key': APP } })
    expect(r.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('read a walk window: refresh the token, then roll up each type over the whole window', async () => {
    kv.store.set(AUTH_KEY, { refreshToken: 'rt' })
    fetchMock.mockImplementation(async (url, init = {}) => {
      if (url === 'https://oauth2.googleapis.com/token') return json(200, { access_token: 'at', expires_in: 3600 })
      const type = url.match(/dataTypes\/([^/]+)\//)[1]
      const body = JSON.parse(init.body)
      expect(init.headers.Authorization).toBe('Bearer at')
      expect(body.windowSize).toBe('2700s')
      const point = { startTime: body.range.startTime, endTime: body.range.endTime }
      if (type === 'steps') return json(200, { rollupDataPoints: [{ ...point, steps: { countSum: '4211' } }] })
      if (type === 'heart-rate') return json(200, { rollupDataPoints: [{ ...point, heartRate: { beatsPerMinuteAvg: 96.4, beatsPerMinuteMax: 131 } }] })
      if (type === 'floors') return json(500, { error: { status: 'INTERNAL', message: 'boom' } })
      return json(200, {})
    })
    const r = await call({
      query: { mode: 'window', start: '2026-11-04T10:00:00Z', end: '2026-11-04T10:45:00Z' },
      headers: { 'x-health-key': APP },
    })
    expect(r.statusCode).toBe(200)
    // a failed optional part (floors) is null, not a failed walk
    expect(r.body).toMatchObject({ steps: 4211, floors: null, distanceKm: null, heart: { avg: 96, max: 131 } })
  })

  it('mark the connection lost when Google refuses the refresh token', async () => {
    kv.store.set(AUTH_KEY, { refreshToken: 'rt', connectedAt: 'x' })
    fetchMock.mockResolvedValue(json(400, { error: 'invalid_grant' }))
    const r = await call({ query: { mode: 'sleep', from: '2026-11-03', to: '2026-11-04' }, headers: { 'x-health-key': APP } })
    expect(r.statusCode).toBe(409)
    expect(r.body.code).toBe('reconnect')
    expect(kv.store.get(AUTH_KEY)).toMatchObject({ refreshToken: null })
    expect(kv.store.get(AUTH_KEY).lostAt).toBeTruthy()
  })
})

describe('consent flow', () => {
  it('connect sends a correct key to Google with offline, read-only scopes', async () => {
    const r = await call({ query: { mode: 'connect' }, method: 'POST', body: { key: APP } })
    expect(r.statusCode).toBe(303)
    const url = new URL(r.headers.location)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('redirect_uri')).toBe('https://coneofcold.vercel.app/api/google-health/callback')
    const scopes = url.searchParams.get('scope').split(' ')
    expect(scopes.length).toBe(3)
    expect(scopes.every((s) => s.endsWith('.readonly'))).toBe(true)
  })

  it('connect bounces a wrong key back to the page', async () => {
    const r = await call({ query: { mode: 'connect' }, method: 'POST', body: 'key=wrong' })
    expect(r.headers.location).toBe('/google-health.html?error=key')
  })

  it('callback refuses a state it did not sign', async () => {
    const r = await call({ query: { mode: 'callback', code: 'c', state: makeState('someone-else') } })
    expect(r.headers.location).toBe('/google-health.html?error=state')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('callback stores the refresh token and nothing else', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'at', refresh_token: 'rt-new', expires_in: 3600, scope: 'a b' }))
    const r = await call({ query: { mode: 'callback', code: 'c', state: makeState(APP) } })
    expect(r.headers.location).toBe('/google-health.html?connected=1')
    expect(kv.store.get(AUTH_KEY)).toMatchObject({ refreshToken: 'rt-new', scope: 'a b' })
  })
})

describe('MCP', () => {
  it('hides itself behind the path key', async () => {
    const r = await call({ query: { mode: 'mcp', key: 'guess' }, method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'ping' } })
    expect(r.statusCode).toBe(404)
  })

  it('answers JSON-RPC, and 202 for notifications', async () => {
    const init = await call({ query: { mode: 'mcp', key: MCP }, method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } } })
    expect(init.statusCode).toBe(200)
    expect(init.body.result.serverInfo.name).toBe('google-health')
    const note = await call({ query: { mode: 'mcp', key: MCP }, method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })
    expect(note.statusCode).toBe(202)
  })

  it('refuses GET (no SSE stream on a stateless server)', async () => {
    const r = await call({ query: { mode: 'mcp', key: MCP } })
    expect(r.statusCode).toBe(405)
  })
})
