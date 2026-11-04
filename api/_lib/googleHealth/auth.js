// The two secrets that gate api/google-health.js, and the signed OAuth `state`.
//
//   GOOGLE_HEALTH_APP_KEY — what the browser apps send (x-health-key). Entered once
//                           on /google-health.html; every app on the origin reads it
//                           from the same localStorage key.
//   GOOGLE_HEALTH_MCP_KEY — the last path segment of the Claude connector URL. Kept
//                           separate so a key pasted into claude.ai can be rotated
//                           without signing every browser out, and the other way round.
//
// Both are compared in constant time. An unset key never matches anything, so a
// half-configured deploy fails closed.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

export function keyMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const STATE_TTL_MS = 10 * 60 * 1000

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/**
 * The OAuth `state`: a timestamp and a nonce, signed with the app key. The
 * callback accepts only a state this deploy issued in the last ten minutes, so a
 * stranger can't finish a consent flow into this deploy's KV.
 */
export function makeState(secret, now = Date.now()) {
  const payload = `${now}.${randomBytes(12).toString('base64url')}`
  return `${payload}.${sign(payload, secret)}`
}

export function stateValid(state, secret, now = Date.now()) {
  if (typeof state !== 'string' || !secret) return false
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [ts, nonce, mac] = parts
  const expected = sign(`${ts}.${nonce}`, secret)
  if (!keyMatches(mac, expected)) return false
  const age = now - Number(ts)
  return Number.isFinite(age) && age >= 0 && age <= STATE_TTL_MS
}
