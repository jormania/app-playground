// Tiny wrapper over Vercel KV's (Upstash Redis) REST API using plain fetch — so the
// reminder endpoints can persist a handful of prefs without adding an npm dependency.
// When the KV env vars aren't present (local dev, or before you create a KV store),
// kvConfigured() is false and callers respond "not set up yet" instead of throwing.
const BASE = process.env.KV_REST_API_URL
const TOKEN = process.env.KV_REST_API_TOKEN

export function kvConfigured() {
  return Boolean(BASE && TOKEN)
}

// Read a JSON value by key, or null if missing / unconfigured.
export async function kvGet(key) {
  if (!kvConfigured()) return null
  const res = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  if (data == null || data.result == null) return null
  try { return JSON.parse(data.result) } catch { return data.result }
}

// Write a JSON value by key. Stored as a JSON string. Returns true on success.
export async function kvSet(key, value) {
  if (!kvConfigured()) return false
  const res = await fetch(`${BASE}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  return res.ok
}
