// Opt-in local push for "tickets just opened" (and, optionally, new listings and
// sold-out) — built on the cross-app shared foundation in src/shared/notify/ (see
// NOTIFICATIONS.md). Diverges from the other four apps wired into that layer in
// one real way: their service workers only ever read a snapshot the PAGE already
// computed from data it had loaded. Marquee's worker has to go GET that data
// itself — "did tickets just open" can only be answered by re-reading the venue
// pages, the same POST to /api/marquee-scan the app's own "Check venues" button
// makes. See public/marquee-sw.js for the half that actually does it.
//
// A THIRD independent snapshot, by design — the same reasoning MARQUEE.md §9.11
// gives for the server cron's own KV snapshot being separate from the client's
// localStorage one: each answers a different "changed since when" question, and
// one shared history two writers could race on is a bug waiting to happen. This
// one lives in IndexedDB because a service worker can't read localStorage.
import { createIdbKv } from '../shared/notify/idbKv'
import { requestPermission, notificationPermission, capabilities } from '../shared/notify/permission'
import {
  registerPeriodicSync as sharedRegisterPeriodicSync,
  unregisterPeriodicSync as sharedUnregisterPeriodicSync,
} from '../shared/notify/periodicSync'
import { scanPayload } from './programme.js'

export const REMINDERS_DB = 'marquee-reminders'
export const REMINDERS_STORE = 'kv'
export const VENUES_KEY = 'venues'
export const PREFS_KEY = 'prefs'
export const TAG = 'marquee-reminders'

// Six hours: a floor the browser is free to widen, not a promise (Periodic
// Background Sync timing is best-effort everywhere — NOTIFICATIONS.md). Frequent
// enough that "tickets just opened" is still timely; sparing enough that a
// browser instance that's rarely closed doesn't out-poll the server's own
// twice-daily cron scan of these same venues (api/wanderlist-remind.js).
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000

const kv = createIdbKv(REMINDERS_DB, REMINDERS_STORE)

/** The extra change kinds "notify about everything" adds. Deliberately NOT
 *  `cancelled` — that needs the full before-vs-after set (a key present last
 *  scan and absent now), which would mean the worker holding onto every event
 *  it has ever seen just to notice one going quiet. Skipped here; still visible
 *  in-app next time the programme is open, the same way a throttled scan
 *  carries a venue's last-known programme forward rather than guessing at it. */
export function notifyKinds(prefs) {
  return prefs?.notifyAllKinds ? ['tickets-opened', 'new-event', 'sold-out'] : ['tickets-opened']
}

/** Mirror what the worker needs whenever the venue list or the notify prefs
 *  change — the same "whenever the relevant data changes" effect every app
 *  wired into this layer writes (NOTIFICATIONS.md's checklist item 2). */
export async function writeNotifyState(venues, prefs) {
  await kv.set(VENUES_KEY, scanPayload(venues))
  await kv.set(PREFS_KEY, { enabled: Boolean(prefs?.notifyEnabled), kinds: notifyKinds(prefs) })
}

export { capabilities, notificationPermission }

/** Request permission (must run from a user gesture) and best-effort register
 *  periodic sync — same shape every other app's `enableReminders` uses. */
export async function enableNotify() {
  const permission = await requestPermission()
  if (permission === 'granted') await registerPeriodicSync()
  return permission
}
export async function registerPeriodicSync() { await sharedRegisterPeriodicSync(TAG, MIN_INTERVAL_MS) }
export async function unregisterPeriodicSync() { await sharedUnregisterPeriodicSync(TAG) }

/**
 * What changed about ONE event between two scans, or null. Mirrors
 * `changes.js`'s own `diff` for the two transitions a single forward pass over
 * `after` can detect without holding the full before-set — see this module's
 * header for why `cancelled` isn't one of them. Duplicated (not imported) into
 * `public/marquee-sw.js`, the classic-script half that actually calls it — a
 * service worker can't `import` an ES module. `notify.sw.test.js` extracts the
 * worker's own copy and runs both against the same cases, so a rule drifting
 * between them shows up as a test failure rather than a silent difference
 * between what a scan and a push notification each claim.
 */
export function kindFor(before, after) {
  if (!before) return 'new-event'
  if (before.ticketState !== 'open' && after.ticketState === 'open') return 'tickets-opened'
  if (before.ticketState !== 'sold-out' && after.ticketState === 'sold-out') return 'sold-out'
  return null
}

/** Every event whose change is one the caller actually wants notified about. */
export function notifiableChanges(beforeMap, events, kinds) {
  const allow = new Set(kinds)
  const out = []
  for (const e of events ?? []) {
    const kind = kindFor(beforeMap?.[e.key], e)
    if (kind && allow.has(kind)) out.push({ kind, key: e.key, title: e.title, venue: e.venue })
  }
  return out
}

const LABEL = { 'tickets-opened': 'tickets on sale', 'sold-out': 'sold out', 'new-event': 'new' }

/** The notification's title — one line, same voice as the email's own
 *  `marqueeOnlySubject` (api/_lib/marquee/emailSection.js), so a ticket opening
 *  reads the same whether it reaches you by push or by the evening email. */
export function notifyTitle(changes) {
  if (changes.length === 1) return `Marquee: "${changes[0].title}" — ${LABEL[changes[0].kind]}`
  const opened = changes.filter((c) => c.kind === 'tickets-opened').length
  return opened > 0 ? `Marquee: ${opened} tickets just opened` : `Marquee: ${changes.length} changes at your venues`
}

/** The notification body — up to three lines, then a count for the rest. A push
 *  notification is read in passing, not studied; MARQUEE.md's own "checkable in
 *  ten seconds" applies here even more than inside the app itself. */
export function notifyBody(changes) {
  const lines = changes.slice(0, 3).map((c) => `${c.title} — ${LABEL[c.kind]} (${c.venue})`)
  if (changes.length > 3) lines.push(`+${changes.length - 3} more`)
  return lines.join('\n')
}

function showNotification(title, body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opts = { body, tag, icon: '/marquee-icon.svg', badge: '/marquee-icon.svg' }
  try {
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, opts))
        .catch(() => { try { new Notification(title, opts) } catch { /* ignore */ } })
    } else {
      new Notification(title, opts)
    }
  } catch { /* ignore */ }
}

/** ?notify=preview — fire one notification immediately, for previewing the
 *  format without waiting for a real background check (mirrors Journal's
 *  ?notify=nudge, Touch Grass's ?call=). */
export function previewFromQuery() {
  let p = null
  try { p = new URLSearchParams(window.location.search).get('notify') } catch { /* ignore */ }
  if (p !== 'preview') return
  const sample = [{ kind: 'tickets-opened', key: 'preview', title: 'Preview Show', venue: 'Preview Venue' }]
  showNotification(notifyTitle(sample), notifyBody(sample), 'marquee-preview')
}
