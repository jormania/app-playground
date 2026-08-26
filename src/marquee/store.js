// Config and which client the app talks to.
//
// Same contract as Radar-B and Wanderlist: a saved Notion token means live, no
// token means fixtures (demo). Storage goes through src/shared/storage.js's
// guarded helpers — Safari private mode throws on setItem, and an unguarded write
// inside a React effect is an uncaught render error.

import { readJson, writeJson, removeJson } from '../shared/storage'
import { parseNotionId } from '../shared/notionId'
import { createNotionClient, VENUES_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtures.js'

const TOKEN_KEY = 'marquee_token'
const VENUES_DB_KEY = 'marquee_venues_db'
const PREFS_KEY = 'marquee_prefs'
const TRIAGE_KEY = 'marquee_triage'

export function getToken() { return readJson(TOKEN_KEY, '') }
export function setToken(token) { writeJson(TOKEN_KEY, String(token || '').trim()) }
export function clearToken() { removeJson(TOKEN_KEY) }
export function isLive() { return Boolean(getToken()) }

export const venuesDb = {
  get: () => readJson(VENUES_DB_KEY, '') || VENUES_DATABASE_ID,
  set: (raw) => {
    const id = parseNotionId(raw)
    if (id) writeJson(VENUES_DB_KEY, id)
    else removeJson(VENUES_DB_KEY)
    return id
  },
}

export const DEFAULT_PREFS = {
  theme: 'system',
  hideSoldOut: false,
  showIgnored: false,
  keepToday: false,
}

export function loadPrefs() {
  return { ...DEFAULT_PREFS, ...readJson(PREFS_KEY, {}) }
}

export function savePrefs(prefs) {
  writeJson(PREFS_KEY, { ...DEFAULT_PREFS, ...prefs })
}

/** Per-production triage — which is now ONLY about ignoring.
 *
 *  Local on purpose: ignoring a film is a mood, not a record, and belongs in the
 *  browser you formed the opinion in rather than in a Notion row someone has to
 *  tidy.
 *
 *  "Saved" used to live here too, and was wrong in three directions: a row added
 *  from Wanderlist never showed here, a row deleted there stayed flagged forever,
 *  and nothing stopped a second copy being written. Wanderlist's Findings is the
 *  source of truth for saved — see findings.js. Any stale `saved` entries from
 *  the old scheme are dropped on read rather than migrated. */
export function loadTriage() {
  const raw = readJson(TRIAGE_KEY, {})
  const out = {}
  for (const [id, state] of Object.entries(raw)) {
    if (state === 'ignored') out[id] = state
  }
  return out
}
export function saveTriage(triage) { writeJson(TRIAGE_KEY, triage ?? {}) }

/** The client the app should use right now. Demo until a token exists. */
export function getClient() {
  const token = getToken()
  if (!token) return createFixtureClient()
  return createNotionClient(token, { venuesDatabaseId: venuesDb.get() })
}
