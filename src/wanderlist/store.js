// The store decides WHICH client the app talks to, and owns the two BYO pieces of
// config: the Notion token and which database to use. Rule: a saved token means live
// Notion; no token means fixtures (demo) mode. Same contract as Journal of Delights.
import { parseNotionId } from './notion.js'
import { createNotionClient, DEFAULT_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtureClient.js'
import { createOfflineClient } from './offlineClient.js'

const TOKEN_KEY = 'wanderlist_token'
const DB_KEY = 'wanderlist_database'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, (token || '').trim()) } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

// The configured database id, defaulting to the built-in one when unset. Stored compact.
export function getDatabaseId() {
  try { return localStorage.getItem(DB_KEY) || DEFAULT_DATABASE_ID } catch { return DEFAULT_DATABASE_ID }
}
export function setDatabaseId(raw) {
  const id = parseNotionId(raw)
  try {
    if (id) localStorage.setItem(DB_KEY, id)
    else localStorage.removeItem(DB_KEY)
  } catch { /* ignore */ }
  return id
}
export function hasCustomDatabase() {
  try { return Boolean(localStorage.getItem(DB_KEY)) } catch { return false }
}

export function isLive() {
  return Boolean(getToken())
}

// ── Theme ─────────────────────────────────────────────────────────────────────
// The six palette presets and the shared `wanderlist_theme` key live in theme.js
// (brought over from Journal of Delights); the header cycle button drives them.
export { loadPreset, savePreset, applyPreset, nextPreset, presetById, modeOf, PRESETS, THEME_KEY } from './theme.js'

// Used by Settings → "Test connection". Builds a live client from the values currently
// typed (not yet saved) and does a cheap reachability check.
export async function testConnection(token, dbRaw) {
  const databaseId = parseNotionId(dbRaw) || DEFAULT_DATABASE_ID
  const client = createNotionClient((token || '').trim(), { databaseId })
  return client.probe()
}

// Build the active client, fresh on demand so just-saved settings take effect without a
// reload. Live mode is wrapped for offline read-cache + write-outbox.
export function getClient() {
  const token = getToken()
  if (!token) return createFixtureClient()
  const databaseId = getDatabaseId()
  return createOfflineClient(createNotionClient(token, { databaseId }), { databaseId })
}
