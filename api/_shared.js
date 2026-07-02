// Shared guardrails for the Notion proxy endpoints (notion.js, notion-upload.js).
// Both are thin, stateless relays to api.notion.com with a per-request BYO token —
// see notion.js's header comment for the full rationale. Split out so the origin
// allowlist and rate limiter aren't duplicated (and can't drift) across the two.
export const NOTION_BASE = 'https://api.notion.com/v1/'

const ALLOWED_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*coneofcold\.vercel\.app$/, /^https?:\/\/localhost(:\d+)?$/]

export function originAllowed(origin) {
  if (!origin) return true
  return ALLOWED_ORIGINS.some((re) => re.test(origin))
}

const RATE_LIMIT = 20 // requests
const RATE_WINDOW_MS = 10_000 // per 10s per IP — generous for one user's real usage
const hits = new Map() // ip -> [timestamps]

export function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 500) hits.clear()
  return recent.length > RATE_LIMIT
}

export function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}
