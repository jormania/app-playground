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
const REMIND_ENDPOINT = '/api/wanderlist-remind'

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

// Fires a real reminder email right now, bypassing the "enabled" toggle and the tomorrow-
// only date filter — so you can confirm the whole pipeline (Notion query → Resend send)
// works without waiting for a real item to be a day out. Uses today's real expiring-soon
// items if there are any due tomorrow, otherwise a single placeholder item, so the button
// always produces a real email to check. Gated the same way as saveServerPrefs: the
// server only accepts it from whoever already holds the matching Notion token.
export async function sendTestReminder() {
  const token = getToken()
  if (!token) return { ok: false, message: 'Connect Notion first.' }
  try {
    const res = await fetch(`${REMIND_ENDPOINT}?test=1`, { headers: { 'x-notion-token': token } })
    const data = await res.json().catch(() => ({}))
    if (res.status === 501) return { ok: false, message: data.message || 'Reminders aren’t set up on the server yet.' }
    if (!res.ok) return { ok: false, message: data.message || `Couldn’t send a test (${res.status}).` }
    if (data.reason === 'no-email') return { ok: false, message: 'Add and save an email above first.' }
    const n = data.sent || 0
    return { ok: true, message: `Test sent — ${n} item${n === 1 ? '' : 's'} in the digest. Check your inbox.` }
  } catch {
    return { ok: false, message: 'Couldn’t reach the server — check your connection.' }
  }
}
