// Decides WHICH client the app talks to and owns the BYO config (Notion token +
// database id) and the remembered view. Rule, same as Wanderlist / JoD: a saved
// token means live Notion; no token means the local demo store.
import { parseNotionId } from './notion.js'
import { createNotionClient } from './notionClient.js'
import { createLocalClient } from './localClient.js'

const TOKEN_KEY = 'loom_token'
const DB_KEY = 'loom_database'
const VIEW_KEY = 'loom_view_prefs'

// The app's built-in default database — the owner's live "Loom" database (see
// the App Databases Notion page). Used out of the box once a token is set, so a
// user only needs to paste a token; any user overrides it in Settings with their
// own copy of the Starter Template. This is a data-source id, not a secret.
export const DEFAULT_DATABASE_ID = '11a0e2d61c8f49c4b92b91fc45add2f5'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, (token || '').trim()) } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

// The configured database id, defaulting to the built-in one when unset.
export function getDatabaseId() {
  try { return localStorage.getItem(DB_KEY) || DEFAULT_DATABASE_ID } catch { return DEFAULT_DATABASE_ID }
}
export function hasCustomDatabase() {
  try { return Boolean(localStorage.getItem(DB_KEY)) } catch { return false }
}
export function setDatabaseId(raw) {
  const id = parseNotionId(raw)
  try {
    if (id) localStorage.setItem(DB_KEY, id)
    else localStorage.removeItem(DB_KEY)
  } catch { /* ignore */ }
  return id
}

// A saved token means live Notion — the database id defaults to the built-in one
// when the user hasn't set their own. No token means the demo store.
export function isLive() {
  return Boolean(getToken())
}

// ── View prefs ──────────────────────────────────────────────────────────────
// Remembers the last view (skeins/loom/tapestry), whether woven threads are
// shown, the focus toggles (unwoven-only, top-of-group-only, collapse-woven) and
// the List-view skein-group sort — so the app reopens exactly where you left it.
export const DEFAULT_VIEW_PREFS = {
  view: 'loom',
  showWoven: false,   // the "unwoven only" focus is simply this turned off
  topOnly: false,     // show only the hot few (top of each group)
  collapseWoven: false, // fold woven threads under a per-group toggle
  skeinSort: 'manual', // 'manual' | 'name' | 'size' | 'heat'
}
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
  const databaseId = parseNotionId(dbRaw) || DEFAULT_DATABASE_ID
  const client = createNotionClient((token || '').trim(), { databaseId })
  return client.probe()
}

// Re-export the theme surface so the app and Settings import palettes from one place.
export { PRESETS, presetById, loadThemePref, saveThemePref, nextTheme, applyTheme, THEME_KEY } from './theme.js'

// Build the active client fresh on demand, so just-saved settings take effect
// without a reload.
export function getClient() {
  if (!isLive()) return createLocalClient()
  return createNotionClient(getToken(), { databaseId: getDatabaseId() })
}
