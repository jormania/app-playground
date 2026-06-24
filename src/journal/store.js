// The store decides WHICH client the app talks to, and owns the two pieces of
// per-user config: the BYO token and which Notion database to use. Rule: a saved
// token means live Notion; no token means fixtures mode. That keeps the app
// usable as a demo until a token is set up, then flips to the real journal the
// moment a token is saved — no code change.
import { parseNotionId } from './notion.js'
import { createNotionClient, DEFAULT_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtureClient.js'

const TOKEN_KEY = 'jod_token'
const DB_KEY = 'jod_database'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, (token || '').trim()) } catch { /* ignore */ }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

// The configured database id, defaulting to the built-in one when the user hasn't
// set their own. Stored as the compact 32-char id.
export function getDatabaseId() {
  try { return localStorage.getItem(DB_KEY) || DEFAULT_DATABASE_ID } catch { return DEFAULT_DATABASE_ID }
}

// Accepts a full Notion URL, a bare id, or a dashed UUID; stores the parsed id.
// Empty/unparseable input clears the override (back to the default database).
export function setDatabaseId(raw) {
  const id = parseNotionId(raw)
  try {
    if (id) localStorage.setItem(DB_KEY, id)
    else localStorage.removeItem(DB_KEY)
  } catch { /* ignore */ }
  return id
}

// True when the configured database is the user's own, not the built-in default.
export function hasCustomDatabase() {
  try { return Boolean(localStorage.getItem(DB_KEY)) } catch { return false }
}

export function isLive() {
  return Boolean(getToken())
}

// ── Theme ───────────────────────────────────────────────────────────────────
// Solarized Dark is the default; the user's choice is remembered and never
// changed automatically. Applied via the <html data-theme> attribute.
const THEME_KEY = 'jod_theme'
const THEME_BAR = { dark: '#002b36', light: '#fdf6e3' } // mobile browser UI bar

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function setTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  try { localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_BAR[t])
  }
}

// Used by the settings "Test connection" button. Builds a live client from the
// values currently typed (not yet saved) and does a cheap reachability check.
export async function testConnection(token, dbRaw) {
  const databaseId = parseNotionId(dbRaw) || DEFAULT_DATABASE_ID
  const client = createNotionClient((token || '').trim(), { databaseId })
  return client.probe()
}

// ── Drafts ──────────────────────────────────────────────────────────────────
// Resilience: the editor auto-saves what you're writing, keyed by date, so a
// failed save, a closed tab, or a refresh never loses a delight. Cleared once the
// entry saves successfully.
const DRAFTS_KEY = 'jod_drafts'

function readDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') } catch { return {} }
}
function writeDrafts(map) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(map)) } catch { /* ignore quota */ }
}

export function getDraft(dateKey) {
  return readDrafts()[dateKey] || null
}
export function saveDraft(dateKey, draft) {
  const map = readDrafts()
  map[dateKey] = draft
  writeDrafts(map)
}
export function clearDraft(dateKey) {
  const map = readDrafts()
  if (dateKey in map) { delete map[dateKey]; writeDrafts(map) }
}

// Build the active client. Created fresh on demand so just-saved settings take
// effect without a reload.
export function getClient() {
  const token = getToken()
  return token ? createNotionClient(token, { databaseId: getDatabaseId() }) : createFixtureClient()
}
