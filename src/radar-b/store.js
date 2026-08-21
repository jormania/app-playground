// Config, local state, and which client the app talks to.
//
// Same contract as Wanderlist: a saved Notion token means live, no token means
// fixtures (demo). Storage goes through src/shared/storage.js's guarded helpers —
// Safari private mode throws on setItem, and an unguarded write inside a React
// effect is an uncaught render error.

import { readJson, writeJson, removeJson } from '../shared/storage'
import { parseNotionId } from '../shared/notionId'
import { createNotionClient, SUGGESTED_PAGE_ID, FINDINGS_DATABASE_ID, RADAR_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtures.js'

const TOKEN_KEY = 'radarb_token'
const RADAR_DB_KEY = 'radarb_radar_db'
const FINDINGS_DB_KEY = 'radarb_findings_db'
const SUGGESTED_KEY = 'radarb_suggested_page'
const PREFS_KEY = 'radarb_prefs'
const LOCAL_KEY = 'radarb_local'
const CACHE_KEY = 'radarb_cache'

export function getToken() { return readJson(TOKEN_KEY, '') }
export function setToken(token) { writeJson(TOKEN_KEY, String(token || '').trim()) }
export function clearToken() { removeJson(TOKEN_KEY) }
export function isLive() { return Boolean(getToken()) }

function idSetting(key, fallback) {
  return {
    get: () => readJson(key, '') || fallback,
    set: (raw) => {
      const id = parseNotionId(raw)
      if (id) writeJson(key, id)
      else removeJson(key)
      return id
    },
  }
}

export const radarDb = idSetting(RADAR_DB_KEY, RADAR_DATABASE_ID)
export const findingsDb = idSetting(FINDINGS_DB_KEY, FINDINGS_DATABASE_ID)
export const suggestedPage = idSetting(SUGGESTED_KEY, SUGGESTED_PAGE_ID)

// ── View prefs ────────────────────────────────────────────────────────────────
// The last lens persists so the app reopens where you left it. The search query
// deliberately does NOT — a stale search on reload is more confusing than helpful.
export const DEFAULT_PREFS = { view: 'tonight', theme: 'system' }
export function loadPrefs() { return { ...DEFAULT_PREFS, ...readJson(PREFS_KEY, {}) } }
export function savePrefs(prefs) { writeJson(PREFS_KEY, { ...DEFAULT_PREFS, ...prefs }) }

// ── Local interaction state ───────────────────────────────────────────────────
// The ONLY personalization in v1, and deliberately non-inferential: what you have
// opened, what you have dismissed, and when each event first appeared. It powers
// "new to you" and sinks dismissed events. It builds no taste model and leaves the
// device — see RADAR_B.md §8. The raw signal is recorded now so that a real
// recommender, if it ever earns its keep, has history to work from.
export const EMPTY_LOCAL = { seen: [], dismissed: [], firstSeen: {} }

export function loadLocal() {
  const raw = readJson(LOCAL_KEY, EMPTY_LOCAL)
  return {
    seen: Array.isArray(raw.seen) ? raw.seen : [],
    dismissed: Array.isArray(raw.dismissed) ? raw.dismissed : [],
    firstSeen: raw.firstSeen && typeof raw.firstSeen === 'object' ? raw.firstSeen : {},
  }
}

export function saveLocal(local) { writeJson(LOCAL_KEY, local) }

/** Stamp any event id we haven't seen before with the moment it entered the pool.
 *  Trimmed to the ids currently present, so the record can't grow without bound. */
export function stampFirstSeen(local, ids) {
  const now = Date.now()
  const firstSeen = {}
  for (const id of ids) firstSeen[id] = local.firstSeen[id] ?? now
  return { ...local, firstSeen }
}

// ── Offline read cache ────────────────────────────────────────────────────────
// One snapshot of the last successful fetch, so opening the app on the metro shows
// the last known week instead of an empty screen. Read-only: Radar-B's single write
// (save to Wanderlist) needs the network and says so rather than queueing.
export function readCache() { return readJson(CACHE_KEY, null) }
export function writeCache(snapshot) { writeJson(CACHE_KEY, { ...snapshot, cachedAt: Date.now() }) }

export async function testConnection(token, radarRaw, findingsRaw) {
  const client = createNotionClient(String(token || '').trim(), {
    radarDatabaseId: parseNotionId(radarRaw) || '',
    findingsDatabaseId: parseNotionId(findingsRaw) || FINDINGS_DATABASE_ID,
  })
  return client.probe()
}

/** Build the active client fresh on demand, so just-saved settings take effect
 *  without a reload. */
export function getClient() {
  const token = getToken()
  if (!token) return createFixtureClient()
  return createNotionClient(token, {
    radarDatabaseId: radarDb.get(),
    findingsDatabaseId: findingsDb.get(),
    suggestedPageId: suggestedPage.get(),
  })
}
