// The store decides WHICH client the app talks to, and owns the two pieces of
// per-user config: the BYO token and which Notion database to use. Rule: a saved
// token means live Notion; no token means fixtures mode. That keeps the app
// usable as a demo until a token is set up, then flips to the real journal the
// moment a token is saved — no code change.
import { parseNotionId } from './notion.js'
import { createNotionClient, DEFAULT_DATABASE_ID } from './notionClient.js'
import { createFixtureClient } from './fixtureClient.js'
import { createOfflineClient } from './offlineClient.js'

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
// The palette presets (six: three light + three dark) and the shared `jod_theme`
// key now live in theme.js — the header cycle button drives them. Kept here as a
// re-export so existing importers keep one home for app state.
export { loadPreset, savePreset, applyPreset, nextPreset, presetById, modeOf, PRESETS, THEME_KEY } from './theme.js'

// ── Gentle reminders ────────────────────────────────────────────────────────
// Opt-in local notifications (see reminders.js): a 9pm nudge to write today's
// delight, and a 7pm "on this day" note. Master toggle plus a per-type opt-out,
// same shape as the theme setting above.
const REMINDERS_KEY = 'jod_reminders_enabled'
const REMINDERS_NUDGE_KEY = 'jod_reminders_nudge'
const REMINDERS_ON_THIS_DAY_KEY = 'jod_reminders_on_this_day'

export function getRemindersEnabled() {
  try { return localStorage.getItem(REMINDERS_KEY) === '1' } catch { return false }
}
export function setRemindersEnabled(on) {
  try { localStorage.setItem(REMINDERS_KEY, on ? '1' : '0') } catch { /* ignore */ }
}
export function getRemindersNudge() {
  try { return localStorage.getItem(REMINDERS_NUDGE_KEY) !== '0' } catch { return true }
}
export function setRemindersNudge(on) {
  try { localStorage.setItem(REMINDERS_NUDGE_KEY, on ? '1' : '0') } catch { /* ignore */ }
}
export function getRemindersOnThisDay() {
  try { return localStorage.getItem(REMINDERS_ON_THIS_DAY_KEY) !== '0' } catch { return true }
}
export function setRemindersOnThisDay(on) {
  try { localStorage.setItem(REMINDERS_ON_THIS_DAY_KEY, on ? '1' : '0') } catch { /* ignore */ }
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
export const discardDraft = clearDraft

// Drafts worth resuming, newest first. Skips empty drafts and — when the current
// entry list is passed — any draft whose date already has a saved (or queued)
// entry, so the strip self-heals instead of showing stale rows.
export function listDrafts(entries = null) {
  const map = readDrafts()
  const savedDates = entries ? new Set(entries.filter(e => e && e.date).map(e => e.date)) : null
  return Object.entries(map)
    .map(([date, d]) => ({ ...d, date: d?.date || date }))
    .filter(d =>
      ((d.title && d.title.trim()) || (d.entry && d.entry.trim()) || d.tags?.length || d.people?.length) &&
      !(savedDates && savedDates.has(d.date))
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Build the active client. Created fresh on demand so just-saved settings take
// effect without a reload.
export function getClient() {
  const token = getToken()
  if (!token) return createFixtureClient()
  const databaseId = getDatabaseId()
  // Wrap the live client so the journal reads from a local cache and queues writes
  // when offline, syncing to Notion on reconnect.
  return createOfflineClient(createNotionClient(token, { databaseId }), { databaseId })
}
