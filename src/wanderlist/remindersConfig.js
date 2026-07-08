// The reminder settings (turn it on, which email/name, what hour) must be readable by a
// server-side cron while the app is closed — so unlike the other apps' purely-local
// notifications, these live server-side in Vercel KV, written and read through
// /api/wanderlist-reminders. We keep a small LOCAL MIRROR too, so Settings can render
// instantly and offline; the server copy is the source of truth for the cron.
//
// Writes are gated by the Notion token: the endpoint only accepts them when the token
// matches the server's WANDERLIST_NOTION_TOKEN, so only you (who already hold the token)
// can change where reminders are sent. See api/wanderlist-reminders.js.
import { getToken } from './store.js'

const LOCAL_KEY = 'wanderlist_reminders'
const ENDPOINT = '/api/wanderlist-reminders'

export const DEFAULT_PREFS = { enabled: false, email: '', name: '', sendHour: 8 }

export function getLocalPrefs() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS }
}

export function setLocalPrefs(prefs) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...DEFAULT_PREFS, ...prefs })) } catch { /* quota */ }
}

// Fetch the authoritative prefs from the server. Returns:
//   { configured: true,  prefs }         — server is set up; prefs is the KV copy
//   { configured: false, message }        — server env (KV / token) not set up yet
//   { error: '…' }                        — reachable but rejected (e.g. token mismatch)
export async function loadServerPrefs() {
  const token = getToken()
  if (!token) return { configured: false, message: 'Connect Notion first.' }
  try {
    const res = await fetch(ENDPOINT, { headers: { 'x-notion-token': token } })
    const data = await res.json().catch(() => ({}))
    if (res.status === 501) return { configured: false, message: data.message || 'Reminders aren’t set up on the server yet.' }
    if (!res.ok) return { error: data.message || `Couldn’t read reminder settings (${res.status}).` }
    if (data.prefs) setLocalPrefs(data.prefs)
    return { configured: true, prefs: { ...DEFAULT_PREFS, ...(data.prefs || {}) } }
  } catch {
    return { error: 'Couldn’t reach the server — check your connection.' }
  }
}

// Persist prefs to the server (and mirror locally). Returns { ok } | { configured:false }
// | { error }.
export async function saveServerPrefs(prefs) {
  setLocalPrefs(prefs) // optimistic local mirror so the UI stays responsive
  const token = getToken()
  if (!token) return { configured: false, message: 'Connect Notion first.' }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notion-token': token },
      body: JSON.stringify(prefs),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 501) return { configured: false, message: data.message || 'Reminders aren’t set up on the server yet.' }
    if (!res.ok) return { error: data.message || `Couldn’t save reminder settings (${res.status}).` }
    return { ok: true, prefs: { ...DEFAULT_PREFS, ...(data.prefs || prefs) } }
  } catch {
    return { error: 'Couldn’t reach the server — check your connection.' }
  }
}
