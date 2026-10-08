/**
 * Spotify sign-in: Authorization Code with PKCE, entirely in the browser.
 *
 * PKCE is Spotify's flow for apps that can't keep a client secret, so there is
 * no secret anywhere — the Client ID is public by design. The callback is
 * validated: the `state` must match the one this tab generated, the verifier
 * must be the one this tab stored, and both are single-use.
 *
 * Spotify only accepts HTTPS redirect URIs, or a loopback IP (http://127.0.0.1)
 * for development — not `localhost`. Register both in the Spotify dashboard:
 *   https://coneofcold.vercel.app/long-listen-react.html
 *   http://127.0.0.1:5173/long-listen-react.html
 */
export const SCOPES = ['user-read-recently-played', 'user-read-playback-state', 'user-modify-playback-state']
const AUTHORIZE = 'https://accounts.spotify.com/authorize'
export const TOKEN_URL = 'https://accounts.spotify.com/api/token'

const PENDING = 'long-listen:spotify-pending'
const TOKENS = 'long-listen:spotify'

export interface SpotifyTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope: string
}

interface Pending {
  state: string
  verifier: string
  clientId: string
  redirectUri: string
  createdAt: number
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomString(bytes = 48): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return base64url(a)
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

export function redirectUriFor(loc: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${loc.origin}${loc.pathname}`
}

/** Build the authorize URL and remember what the callback must prove. */
export async function beginSignIn(clientId: string, redirectUri: string, storage: Storage = sessionStorage): Promise<string> {
  const state = randomString(24)
  const verifier = randomString(64)
  const pending: Pending = { state, verifier, clientId, redirectUri, createdAt: Date.now() }
  storage.setItem(PENDING, JSON.stringify(pending))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
  })
  return `${AUTHORIZE}?${params}`
}

export class SpotifyAuthError extends Error {}

/** Does this URL look like a Spotify callback? */
export function isCallback(search: string): boolean {
  const p = new URLSearchParams(search)
  return p.has('state') && (p.has('code') || p.has('error'))
}

/**
 * Finish sign-in from the callback URL's query string. Throws SpotifyAuthError
 * for a refused, forged, replayed or stale callback.
 */
export async function completeSignIn(
  search: string,
  storage: Storage = sessionStorage,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  now = Date.now(),
): Promise<SpotifyTokens> {
  const params = new URLSearchParams(search)
  const raw = storage.getItem(PENDING)
  storage.removeItem(PENDING) // single use, whatever happens next
  if (params.get('error')) throw new SpotifyAuthError('Spotify sign-in was cancelled.')
  if (!raw) throw new SpotifyAuthError('This sign-in wasn’t started here. Try connecting again.')
  const pending = JSON.parse(raw) as Pending
  if (!params.get('state') || params.get('state') !== pending.state) throw new SpotifyAuthError('The sign-in response didn’t match. Try connecting again.')
  if (now - pending.createdAt > 15 * 60_000) throw new SpotifyAuthError('That sign-in took too long. Try connecting again.')
  const code = params.get('code')
  if (!code) throw new SpotifyAuthError('Spotify sent no authorisation code.')

  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.verifier,
    }),
  })
  if (!res.ok) throw new SpotifyAuthError('Spotify didn’t accept the sign-in. Try connecting again.')
  return tokensFrom(await res.json(), now)
}

function tokensFrom(data: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }, now: number, previous?: SpotifyTokens): SpotifyTokens {
  return {
    accessToken: data.access_token,
    // A refresh may or may not rotate the refresh token; keep the old one if not.
    refreshToken: data.refresh_token ?? previous?.refreshToken,
    expiresAt: now + (data.expires_in - 60) * 1000,
    scope: data.scope ?? previous?.scope ?? '',
  }
}

export async function refresh(tokens: SpotifyTokens, clientId: string, fetchImpl: typeof fetch = (...a) => fetch(...a), now = Date.now()): Promise<SpotifyTokens> {
  if (!tokens.refreshToken) throw new SpotifyAuthError('Spotify needs you to connect again.')
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: clientId }),
  })
  if (!res.ok) throw new SpotifyAuthError('Spotify needs you to connect again.')
  return tokensFrom(await res.json(), now, tokens)
}

export function loadTokens(storage: Storage = localStorage): SpotifyTokens | null {
  try {
    const raw = storage.getItem(TOKENS)
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: SpotifyTokens | null, storage: Storage = localStorage): void {
  try {
    if (tokens) storage.setItem(TOKENS, JSON.stringify(tokens))
    else storage.removeItem(TOKENS)
  } catch { /* storage unavailable — the session just won't persist */ }
}
