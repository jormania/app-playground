// Daily reminder cron. Vercel invokes this once a day (see vercel.json); it emails you
// the items on your Wanderlist whose Date Expiring is *tomorrow* (Europe/Bucharest) and
// that aren't marked Attended. All server-side: it never touches your browser, so it
// works with the app closed.
//
// Config (one-time, see WANDERLIST.md):
//   WANDERLIST_NOTION_TOKEN  — integration token, shared with the Findings DB
//   WANDERLIST_DB_ID         — the database id to query
//   RESEND_API_KEY, REMINDER_FROM — send the email via Resend
//   CRON_SECRET (optional)   — Vercel adds `Authorization: Bearer <secret>` to cron calls
//   KV store (optional)      — holds the {enabled,email,name} prefs from the app; if KV
//                              isn't set, we fall back to REMINDER_EMAIL / REMINDER_NAME.
import { selectExpiring, zonedTomorrowKey, buildReminderEmail } from './lib/reminders.js'
import { kvGet } from './lib/kv.js'
import { PREFS_KEY } from './wanderlist-reminders.js'

const NOTION_VERSION = '2022-06-28'
const TIMEZONE = 'Europe/Bucharest'

// Minimal row → item mapping (only the fields the email needs). Kept local so the cron
// bundle doesn't reach into the Vite src tree.
function mapRow(page) {
  const p = page?.properties || {}
  const plain = (rt) => Array.isArray(rt) ? rt.map(x => x?.plain_text ?? x?.text?.content ?? '').join('') : ''
  return {
    id: page?.id,
    name: plain((p.Name || p.Title)?.title) || 'Untitled',
    place: plain(p.Place?.rich_text),
    link: p.Link?.url || '',
    dateExpiring: p['Date Expiring']?.date?.start || null,
    attended: Boolean(p.Attended?.checkbox),
  }
}

export default async function handler(req, res) {
  // Guard: when CRON_SECRET is set, only accept the call Vercel Cron makes (or a manual
  // run carrying the same secret).
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization || ''
    const q = (req.query && (req.query.secret || req.query.key)) || ''
    if (auth !== `Bearer ${secret}` && q !== secret) {
      res.status(401).json({ message: 'Unauthorised.' })
      return
    }
  }

  const token = process.env.WANDERLIST_NOTION_TOKEN
  const dbId = process.env.WANDERLIST_DB_ID
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM
  if (!token || !dbId || !resendKey || !from) {
    res.status(501).json({ message: 'Reminder cron not fully configured (need WANDERLIST_NOTION_TOKEN, WANDERLIST_DB_ID, RESEND_API_KEY, REMINDER_FROM).' })
    return
  }

  // Prefs from KV, falling back to env for a KV-less setup.
  const stored = (await kvGet(PREFS_KEY)) || {}
  const prefs = {
    enabled: stored.enabled != null ? Boolean(stored.enabled) : true,
    email: stored.email || process.env.REMINDER_EMAIL || '',
    name: stored.name || process.env.REMINDER_NAME || '',
  }
  const dryRun = Boolean(req.query && (req.query.dryRun || req.query.dry))

  if (!prefs.enabled) { res.status(200).json({ sent: 0, reason: 'disabled' }); return }
  if (!prefs.email) { res.status(200).json({ sent: 0, reason: 'no-email' }); return }

  const tomorrow = zonedTomorrowKey(new Date(), TIMEZONE)

  let items = []
  try {
    const nres = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_size: 100,
        filter: {
          and: [
            { property: 'Date Expiring', date: { equals: tomorrow } },
            { property: 'Attended', checkbox: { equals: false } },
          ],
        },
      }),
    })
    if (!nres.ok) {
      const text = await nres.text()
      res.status(502).json({ message: `Notion query failed (${nres.status})`, detail: text.slice(0, 300) })
      return
    }
    const data = await nres.json()
    // selectExpiring re-checks the rule in case the DB filter and our mapping ever drift.
    items = selectExpiring((data.results || []).map(mapRow), tomorrow)
  } catch (err) {
    res.status(502).json({ message: `Could not reach Notion: ${err.message}` })
    return
  }

  if (items.length === 0) { res.status(200).json({ sent: 0, tomorrow, reason: 'nothing-expiring' }); return }

  const email = buildReminderEmail(items, { name: prefs.name, tomorrowKey: tomorrow })

  if (dryRun) { res.status(200).json({ dryRun: true, tomorrow, count: items.length, to: prefs.email, email }); return }

  try {
    const rres = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: prefs.email, subject: email.subject, html: email.html, text: email.text }),
    })
    if (!rres.ok) {
      const text = await rres.text()
      res.status(502).json({ message: `Resend send failed (${rres.status})`, detail: text.slice(0, 300) })
      return
    }
  } catch (err) {
    res.status(502).json({ message: `Could not reach Resend: ${err.message}` })
    return
  }

  res.status(200).json({ sent: items.length, tomorrow })
}
