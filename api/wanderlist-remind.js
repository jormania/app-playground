// Reminder cron. Vercel invokes this once a day, but TWICE (see vercel.json) — once at
// 16:00 UTC and once at 17:00 UTC — because Hobby-plan cron can't run more than once a
// day, yet Bucharest's UTC offset flips with DST (+3 EEST / +2 EET), so hitting "7pm
// local" year-round needs one entry per offset. Each invocation checks the ACTUAL local
// hour (zonedHour) and no-ops unless it's genuinely evening there — so only one of the
// two ever really sends on any given day. (Hobby cron also has up to ~59min of jitter
// within its scheduled hour, so "7pm" here means "some time in the 7 o'clock hour", not
// the exact minute — a platform limit, not something this code can tighten further.)
//
// Emails the items on your Wanderlist that are unattended and, for tomorrow, either
// Expiring (a deadline closing), Planned (a date you've set but not confirmed), or
// Planned-and-Going (confirmed) — each one labelled with which it is. All server-side: it
// never touches your browser, so it works with the app closed.
//
// Once a week (IDEA_NUDGE_WEEKDAY, Sunday) it also appends a gentle nudge about "ideas" —
// unattended items with no Planned Date and no Date Expiring, added ≥30 days ago — the
// someday pile that never surfaces on the calendar and is easy to forget. Weekly, not
// daily, so it never becomes noise; it piggybacks on the same evening send.
//
// Also answers `?test=1` — Settings' "Send test reminder" button. That path skips the
// CRON_SECRET (browsers can't hold it) and the local-hour gate (a test press should always
// send now, not wait for evening) and is instead gated like wanderlist-reminders.js: only
// a caller whose `x-notion-token` matches WANDERLIST_NOTION_TOKEN (i.e. you) can trigger
// it. A test send always actually sends — ignoring the enabled toggle — and, if nothing's
// really due tomorrow, emails one placeholder item so the button always produces a real
// message to check.
//
// Config (one-time, see WANDERLIST.md):
//   WANDERLIST_NOTION_TOKEN  — integration token, shared with the Findings DB
//   WANDERLIST_DB_ID         — the database id to query
//   RESEND_API_KEY, REMINDER_FROM — send the email via Resend
//   CRON_SECRET (optional)   — Vercel adds `Authorization: Bearer <secret>` to cron calls
//   KV store (optional)      — holds the {enabled,email,name} prefs from the app; if KV
//                              isn't set, we fall back to REMINDER_EMAIL / REMINDER_NAME.
import { selectDueTomorrow, selectStaleIdeas, zonedTomorrowKey, zonedTodayKey, zonedHour, zonedWeekday, splitPlannedStart, buildReminderEmail } from './_lib/reminders.js'
import { kvGet } from './_lib/kv.js'
import { PREFS_KEY } from './wanderlist-reminders.js'
import { originAllowed, rateLimited, clientIp } from './_shared.js'

const NOTION_VERSION = '2022-06-28'
const TIMEZONE = 'Europe/Bucharest'
const SEND_HOUR = 19       // local hour this reminder should go out
const IDEA_NUDGE_WEEKDAY = 0 // Sunday — the one day a week stale ideas are nudged (0 = Sun)
const IDEA_MIN_AGE_DAYS = 30 // an idea must be at least this old to be nudged about

// Minimal row → item mapping (only the fields the email needs). Kept local so the cron
// bundle doesn't reach into the Vite src tree.
function mapRow(page) {
  const p = page?.properties || {}
  const plain = (rt) => Array.isArray(rt) ? rt.map(x => x?.plain_text ?? x?.text?.content ?? '').join('') : ''
  const planned = splitPlannedStart(p['Planned Date']?.date?.start ?? null)
  return {
    id: page?.id,
    name: plain((p.Name || p.Title)?.title) || 'Untitled',
    place: plain(p.Place?.rich_text),
    link: p.Link?.url || '',
    dateExpiring: p['Date Expiring']?.date?.start || null,
    dateAdded: p['Date Added']?.date?.start || null,
    plannedDate: planned.date,
    plannedTime: planned.time,
    going: Boolean(p.Going?.checkbox),
    attended: Boolean(p.Attended?.checkbox),
  }
}

// One Notion query helper — POSTs a filter, returns mapped rows (or throws with a message).
async function queryNotion(dbId, token, filter) {
  const nres = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_size: 100, filter }),
  })
  if (!nres.ok) {
    const text = await nres.text()
    const err = new Error(`Notion query failed (${nres.status})`)
    err.detail = text.slice(0, 300)
    throw err
  }
  const data = await nres.json()
  return (data.results || []).map(mapRow)
}

export default async function handler(req, res) {
  const token = process.env.WANDERLIST_NOTION_TOKEN
  const dbId = process.env.WANDERLIST_DB_ID
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM
  if (!token || !dbId || !resendKey || !from) {
    res.status(501).json({ message: 'Reminder cron not fully configured (need WANDERLIST_NOTION_TOKEN, WANDERLIST_DB_ID, RESEND_API_KEY, REMINDER_FROM).' })
    return
  }

  const isTest = Boolean(req.query && (req.query.test || req.query.testSend))

  if (isTest) {
    // Browser-triggered test send: same gate as wanderlist-reminders.js's writes — only
    // whoever already holds the matching Notion token can fire it.
    if (!originAllowed(req.headers.origin)) { res.status(403).json({ message: 'Origin not allowed.' }); return }
    if (rateLimited(clientIp(req))) { res.status(429).json({ message: 'Too many requests — try again shortly.' }); return }
    const callerToken = req.headers['x-notion-token']
    if (!callerToken || callerToken !== token) { res.status(401).json({ message: 'Not authorised to send a test reminder.' }); return }
  } else {
    // Cron path: only accept the call Vercel Cron makes (or a manual run carrying the
    // same secret), when CRON_SECRET is set.
    const secret = process.env.CRON_SECRET
    if (secret) {
      const auth = req.headers.authorization || ''
      const q = (req.query && (req.query.secret || req.query.key)) || ''
      if (auth !== `Bearer ${secret}` && q !== secret) {
        res.status(401).json({ message: 'Unauthorised.' })
        return
      }
    }
  }

  const dryRun = !isTest && Boolean(req.query && (req.query.dryRun || req.query.dry))

  // Two cron entries fire daily (one per DST offset — see the file header); only the one
  // where it's actually evening in Bucharest right now should send. A test press or a
  // manual dry run bypasses this — both are deliberate, on-demand triggers.
  if (!isTest && !dryRun && zonedHour(new Date(), TIMEZONE) !== SEND_HOUR) {
    res.status(200).json({ sent: 0, reason: 'not-the-scheduled-hour-here' })
    return
  }

  // Prefs from KV, falling back to env for a KV-less setup.
  const stored = (await kvGet(PREFS_KEY)) || {}
  const prefs = {
    enabled: stored.enabled != null ? Boolean(stored.enabled) : true,
    email: stored.email || process.env.REMINDER_EMAIL || '',
    name: stored.name || process.env.REMINDER_NAME || '',
  }

  if (!isTest && !prefs.enabled) { res.status(200).json({ sent: 0, reason: 'disabled' }); return }
  if (!prefs.email) { res.status(200).json({ sent: 0, reason: 'no-email' }); return }

  const now = new Date()
  const tomorrow = zonedTomorrowKey(now, TIMEZONE)
  const todayK = zonedTodayKey(now, TIMEZONE)
  // The stale-idea nudge is weekly (see IDEA_NUDGE_WEEKDAY) so it never becomes daily noise;
  // a test send always includes it so you can see the whole email.
  const nudgeIdeas = isTest || zonedWeekday(now, TIMEZONE) === IDEA_NUDGE_WEEKDAY

  let items = []
  let ideas = []
  try {
    const dueRows = await queryNotion(dbId, token, {
      and: [
        { property: 'Attended', checkbox: { equals: false } },
        {
          or: [
            { property: 'Date Expiring', date: { equals: tomorrow } },
            { property: 'Planned Date', date: { equals: tomorrow } },
          ],
        },
      ],
    })
    // selectDueTomorrow re-checks the rule in case the DB filter and our mapping ever
    // drift (e.g. a Planned Date's `equals` matching a day it merely overlaps in time).
    items = selectDueTomorrow(dueRows, tomorrow)

    if (nudgeIdeas) {
      const cutoff = zonedTomorrowKey(new Date(now.getTime() - (IDEA_MIN_AGE_DAYS + 1) * 86400000), TIMEZONE)
      const ideaRows = await queryNotion(dbId, token, {
        and: [
          { property: 'Attended', checkbox: { equals: false } },
          { property: 'Planned Date', date: { is_empty: true } },
          { property: 'Date Expiring', date: { is_empty: true } },
          { property: 'Date Added', date: { on_or_before: cutoff } },
        ],
      })
      ideas = selectStaleIdeas(ideaRows, todayK, IDEA_MIN_AGE_DAYS)
    }
  } catch (err) {
    res.status(502).json({ message: `Could not reach Notion: ${err.message}`, detail: err.detail })
    return
  }

  // A test send with nothing genuinely due tomorrow still emails one placeholder item, so
  // the button always produces a real message to check.
  if (isTest && items.length === 0 && ideas.length === 0) {
    items = [{ id: 'test', name: 'Test reminder — Wanderlist', place: '', link: '', dateExpiring: tomorrow, attended: false, statuses: ['expiring'] }]
  }

  if (items.length === 0 && ideas.length === 0) { res.status(200).json({ sent: 0, tomorrow, reason: 'nothing-due' }); return }

  const email = buildReminderEmail(items, { name: prefs.name, ideas })
  if (isTest) email.subject = `[Test] ${email.subject}`

  if (dryRun) { res.status(200).json({ dryRun: true, tomorrow, count: items.length, ideas: ideas.length, to: prefs.email, email }); return }

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

  res.status(200).json({ sent: items.length + ideas.length, due: items.length, ideas: ideas.length, tomorrow, test: isTest })
}
