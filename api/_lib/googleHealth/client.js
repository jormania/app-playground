// Google OAuth and the authenticated call to health.googleapis.com.
//
// One owner, one Google account. The refresh token lives in KV under AUTH_KEY;
// nothing health-related is ever written there — every reading is fetched live
// and passed straight through. The access token is cached in module memory only,
// so a cold start simply refreshes once.
//
// Config (Vercel → Settings → Environment Variables), see GOOGLE_HEALTH.md:
//   GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET — the OAuth web client
//   GOOGLE_HEALTH_REDIRECT_URI (optional) — defaults to the production callback
//   KV_REST_API_URL / KV_REST_API_TOKEN — the Upstash store Wanderlist already uses
import { kvGet, kvSet } from '../kv.js'

export const AUTH_KEY = 'google-health:auth'
export const API_BASE = 'https://health.googleapis.com/v4/'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const DEFAULT_REDIRECT = 'https://coneofcold.vercel.app/api/google-health/callback'

// Read-only, and only the three groups the apps and the connector read. Location
// (exercise GPS), ECG, IRN and reproductive health are left out on purpose: the
// Inspire 3 records none of the first three, and nothing here needs the fourth.
export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
]

export class HealthError extends Error {
  constructor(message, status = 502, code = 'upstream') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function oauthConfig() {
  return {
    clientId: process.env.GOOGLE_HEALTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_HEALTH_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_HEALTH_REDIRECT_URI || DEFAULT_REDIRECT,
  }
}

export function oauthConfigured() {
  const c = oauthConfig()
  return Boolean(c.clientId && c.clientSecret)
}

export function authorizeUrl(state) {
  const c = oauthConfig()
  const q = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // Always show consent: Google only issues a refresh token on a consent screen,
    // and a reconnect without one would leave KV holding a dead token.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${q}`
}

async function tokenRequest(params) {
  const c = oauthConfig()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

let cached = null // { token, exp }

/** Test seam: forget the in-memory access token. */
export function resetTokenCache() {
  cached = null
}

/** Finish the consent flow: trade the code for tokens and keep the refresh token. */
export async function exchangeCode(code) {
  const { ok, data } = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: oauthConfig().redirectUri })
  if (!ok || !data.refresh_token) {
    throw new HealthError(data.error_description || data.error || 'Google did not return a refresh token.', 400, 'exchange')
  }
  const auth = { refreshToken: data.refresh_token, scope: data.scope || '', connectedAt: new Date().toISOString() }
  const saved = await kvSet(AUTH_KEY, auth)
  if (!saved) throw new HealthError('Could not save the connection (is the KV store set up?).', 500, 'kv')
  cached = data.access_token ? { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 } : null
  return auth
}

export async function loadAuth() {
  const auth = await kvGet(AUTH_KEY)
  return auth && auth.refreshToken ? auth : null
}

async function accessToken() {
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token
  const auth = await loadAuth()
  if (!auth) throw new HealthError('Google Health is not connected yet.', 409, 'not_connected')
  const { ok, data } = await tokenRequest({ refresh_token: auth.refreshToken, grant_type: 'refresh_token' })
  if (!ok) {
    // invalid_grant: revoked, expired (Testing-mode tokens die after 7 days), or
    // the password changed. Only a fresh consent fixes any of them.
    if (data.error === 'invalid_grant') {
      await kvSet(AUTH_KEY, { ...auth, refreshToken: null, lostAt: new Date().toISOString() })
      throw new HealthError('Google ended the connection. Reconnect on /google-health.html.', 409, 'reconnect')
    }
    throw new HealthError(data.error_description || 'Could not refresh the Google token.', 502)
  }
  cached = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 }
  return cached.token
}

export async function disconnect() {
  const auth = await kvGet(AUTH_KEY)
  if (auth && auth.refreshToken) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(auth.refreshToken)}`, { method: 'POST' }).catch(() => {})
  }
  cached = null
  await kvSet(AUTH_KEY, null)
}

/**
 * One call to the Health API as the owner. `path` is relative to /v4/, e.g.
 * `users/me/dataTypes/steps/dataPoints:rollUp`. Errors come back as HealthError
 * carrying Google's own message, because "ACCOUNT_NOT_LINKED" or "PERMISSION_DENIED"
 * is the most useful thing the person can read.
 */
export async function healthFetch(path, { method = 'GET', query, body } = {}) {
  const token = await accessToken()
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}` : ''
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = data.error || {}
    const status = res.status === 401 || res.status === 403 ? res.status : res.status === 429 ? 429 : 502
    throw new HealthError(`${e.status || res.status}: ${e.message || 'Google Health API error'}`, status, e.status || 'upstream')
  }
  return data
}
