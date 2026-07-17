// Decides WHICH client the app talks to and owns the BYO config (Notion token +
// database id) and the remembered view. Rule, same as Wanderlist / JoD: a saved
// token means live Notion; no token means the local demo store.
import { parseNotionId } from './notion.js'
import { createNotionClient } from './notionClient.js'
import { createLocalClient } from './localClient.js'

const TOKEN_KEY = 'loom_token'
const DB_KEY = 'loom_database'
const VIEW_KEY = 'loom_view_prefs'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, (token || '').trim()) } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export function getDatabaseId() {
  try { return localStorage.getItem(DB_KEY) || '' } catch { return '' }
}
export function setDatabaseId(raw) {
  const id = parseNotionId(raw)
  try {
    if (id) localStorage.setItem(DB_KEY, id)
    else localStorage.removeItem(DB_KEY)
  } catch { /* ignore */ }
  return id
}

// Live only when BOTH a token and a database id are set — a token alone has
// nowhere to read from, so we fall back to the demo store rather than erroring.
export function isLive() {
  return Boolean(getToken() && getDatabaseId())
}

// ── View prefs ──────────────────────────────────────────────────────────────
// Remembers the last view (skeins/loom) and whether woven threads are shown, so
// the app reopens where you left it.
export const DEFAULT_VIEW_PREFS = { view: 'loom', showWoven: false }
export function loadViewPrefs() {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw) return { ...DEFAULT_VIEW_PREFS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_VIEW_PREFS }
}
export function saveViewPrefs(prefs) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify({ ...DEFAULT_VIEW_PREFS, ...prefs })) } catch { /* quota */ }
}

// Settings → "Test connection": build a live client from the typed-but-unsaved
// values and do a cheap reachability check.
export async function testConnection(token, dbRaw) {
  const databaseId = parseNotionId(dbRaw)
  if (!databaseId) throw new Error('That doesn’t look like a Notion database link or id.')
  const client = createNotionClient((token || '').trim(), { databaseId })
  return client.probe()
}

// Build the active client fresh on demand, so just-saved settings take effect
// without a reload.
export function getClient() {
  if (!isLive()) return createLocalClient()
  return createNotionClient(getToken(), { databaseId: getDatabaseId() })
}
