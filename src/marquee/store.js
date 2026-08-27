// Config and which client the app talks to.
//
// Same contract as Radar-B and Wanderlist: a saved Notion token means live, no
// token means fixtures (demo). Storage goes through src/shared/storage.js's
// guarded helpers — Safari private mode throws on setItem, and an unguarded write
// inside a React effect is an uncaught render error.

import { readJson, writeJson, removeJson } from '../shared/storage'
import { parseNotionId } from '../shared/notionId'
import { createNotionClient, VENUES_DATABASE_ID, FINDINGS_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtures.js'

const TOKEN_KEY = 'marquee_token'
const VENUES_DB_KEY = 'marquee_venues_db'
const FINDINGS_DB_KEY = 'marquee_findings_db'
const PREFS_KEY = 'marquee_prefs'
const TRIAGE_KEY = 'marquee_triage'
const DISMISSED_CHANGES_KEY = 'marquee_dismissed_changes'

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

export const venuesDb = idSetting(VENUES_DB_KEY, VENUES_DATABASE_ID)
/** Wanderlist's Findings — read for dedupe, written when you keep something.
 *  Overridable because the integration may be pointed at a copy of the DB. */
export const findingsDb = idSetting(FINDINGS_DB_KEY, FINDINGS_DATABASE_ID)

export const DEFAULT_PREFS = {
  theme: 'system',
  hideSoldOut: false,
  showIgnored: false,
  keepToday: false,
  hideKept: false,
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

/** Which "what changed" entries (as `kind:key` signatures) have already been
 *  shown and dismissed — persisted so a later check that finds nothing NEW
 *  doesn't resurface them, rather than the strip resetting itself on every
 *  successful scan regardless of whether the diff actually changed.
 *
 *  Capped rather than left to grow forever: a signature is one-shot (the same
 *  showing doesn't transition "tickets opened" twice), so nothing past a few
 *  hundred entries is ever consulted again — keeping only the most recent
 *  bounds the storage without needing to know which ones are still "live". */
const MAX_DISMISSED = 300

export function loadDismissedChanges() {
  const raw = readJson(DISMISSED_CHANGES_KEY, [])
  return Array.isArray(raw) ? raw : []
}
export function saveDismissedChanges(keys) {
  writeJson(DISMISSED_CHANGES_KEY, (keys ?? []).slice(-MAX_DISMISSED))
}

/** The client the app should use right now. Demo until a token exists. */
export function getClient() {
  return clientFor(getToken(), venuesDb.get(), findingsDb.get())
}

/** A client for credentials that have NOT been saved yet — what Settings' "Test
 *  connection" has to use. Testing through `getClient()` tested whatever was
 *  already stored, so pasting a token and pressing Test reported on the OLD one:
 *  a fresh token read as broken, and a revoked one read as fine, both at exactly
 *  the moment someone is trying to find out which. */
export function clientFor(rawToken, venuesId, findingsId) {
  const token = String(rawToken || '').trim()
  if (!token) return createFixtureClient()
  return createNotionClient(token, {
    venuesDatabaseId: parseNotionId(venuesId) || venuesDb.get(),
    findingsDatabaseId: parseNotionId(findingsId) || findingsDb.get(),
  })
}
