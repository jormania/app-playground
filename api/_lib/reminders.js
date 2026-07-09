// Pure logic for the Wanderlist reminder — no network, no env, no Notion — so the rule
// that decides "who gets emailed today, and why" is unit-tested in isolation (mirrors
// api/lib/generatorRotation.js). The cron (api/wanderlist-remind.js) wires this to the
// real Notion query + Resend send.
//
// The rule: an unattended item is due a reminder when, for tomorrow (in the user's
// timezone), it's either Expiring, Planned, or Planned-and-Going — each one gets a
// per-item status label rather than a single generic "expires" line, since the three
// mean different things (a deadline to act vs. something you're actually going to).

// The local YYYY-MM-DD calendar date in an IANA timezone for a given instant. Uses
// Intl so we don't pull in a tz library; falls back to UTC if the zone is unknown.
export function zonedTodayKey(now = new Date(), timeZone = 'Europe/Bucharest') {
  try {
    // en-CA formats as YYYY-MM-DD, which is exactly the key shape we want.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

// Add `n` whole days to a 'YYYY-MM-DD' key, returning a 'YYYY-MM-DD' key. Uses UTC math
// on a noon anchor so it never trips over DST.
export function addDays(key, n) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (!y || !m || !d) return key
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

// Tomorrow's key in the given timezone.
export function zonedTomorrowKey(now = new Date(), timeZone = 'Europe/Bucharest') {
  return addDays(zonedTodayKey(now, timeZone), 1)
}

// The current local hour (0–23) in the given timezone. Vercel Hobby cron can't run more
// than once a day, and Bucharest's UTC offset flips with DST (+2 EET / +3 EEST) — so
// hitting "7pm local" year-round needs two cron entries (one per offset, see vercel.json)
// with each invocation checking this and no-op'ing if it isn't actually evening there yet.
export function zonedHour(now = new Date(), timeZone = 'Europe/Bucharest') {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hour12: false }).format(now))
  } catch {
    return now.getUTCHours()
  }
}

// Split a Notion date property's `start` into a plain day key + an optional 'HH:MM' time —
// mirrors src/wanderlist/notion.js's splitPlannedDate, duplicated here for the same
// no-reach-into-src reason as formatTime12 below. A bare date has no time component; a
// datetime ('2026-07-12T19:30:00.000+03:00') does.
export function splitPlannedStart(start) {
  if (!start) return { date: null, time: null }
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(start)
  if (!m) return { date: null, time: null }
  return { date: m[1], time: m[2] || null }
}

// Which of the three roles an item is due under, for the given day key. An item can carry
// more than one (e.g. it expires AND is planned the same day) — the email lists all of them.
export function statusesFor(entry, dayKey) {
  const s = []
  if (entry?.dateExpiring === dayKey) s.push('expiring')
  if (entry?.plannedDate === dayKey) s.push(entry.going ? 'going' : 'planned')
  return s
}

// The items due a reminder for the given day key: unattended, and Expiring, Planned, or
// Going on that day. Pure — the caller supplies both the mapped items and the target key.
// Each returned item carries a `statuses` array (see statusesFor) for the email to explain.
export function selectDueTomorrow(entries, dayKey) {
  if (!dayKey) return []
  return (entries || [])
    .filter(e => e && !e.attended)
    .map(e => ({ ...e, statuses: statusesFor(e, dayKey) }))
    .filter(e => e.statuses.length > 0)
}

// 'HH:MM' (24h) -> '7:30pm' (12h, lowercase am/pm) — mirrors src/wanderlist/dates.js's
// formatTime, duplicated here (not imported) so the cron bundle doesn't reach into the
// Vite src tree. Returns '' for anything not shaped like a time.
export function formatTime12(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(time || ''))
  if (!m) return ''
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${min}${ampm}`
}

// The one-line explanation for why an item is in tomorrow's digest — every status it
// carries, joined, so an item that's both expiring and planned the same day says so.
function statusPhrase(it) {
  const parts = []
  if (it.statuses.includes('expiring')) parts.push('expires tomorrow')
  if (it.statuses.includes('going')) {
    parts.push(`you’re going tomorrow${it.plannedTime ? ` at ${formatTime12(it.plannedTime)}` : ''}`)
  } else if (it.statuses.includes('planned')) {
    parts.push(`planned for tomorrow${it.plannedTime ? ` at ${formatTime12(it.plannedTime)}` : ''} — you haven’t said you’re going yet`)
  }
  return parts.join(' · ')
}

// Compose the digest email (subject + plain-text + minimal HTML body) for a batch of items
// due tomorrow (each carrying `statuses` from selectDueTomorrow). Pure and
// presentation-only; the cron just hands the result to Resend.
export function buildReminderEmail(items, { name = '' } = {}) {
  const n = items.length
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const subject = n === 1
    ? `Wanderlist: “${items[0].name}” — ${statusPhrase(items[0])}`
    : `Wanderlist: ${n} things tomorrow`
  const lines = items.map(it => {
    const bits = [`${it.name} — ${statusPhrase(it)}`]
    if (it.place) bits.push(`  ${it.place}`)
    if (it.link) bits.push(`  ${it.link}`)
    return `• ${bits.join('\n')}`
  })
  const text = [
    greeting,
    '',
    n === 1 ? 'One thing on your Wanderlist, for tomorrow:' : `${n} things on your Wanderlist, for tomorrow:`,
    '',
    ...lines,
    '',
    'Catch the ones expiring while you can, and firm up the ones you\'re still deciding on — or mark anything attended if you already went.',
    '',
    '— Wanderlist',
  ].join('\n')
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const htmlItems = items.map(it => {
    const title = it.link ? `<a href="${esc(it.link)}">${esc(it.name)}</a>` : esc(it.name)
    const place = it.place ? ` <span style="color:#8a7f6a">— ${esc(it.place)}</span>` : ''
    return `<li style="margin:6px 0">${title}${place}<br><span style="color:#8a7f6a;font-size:0.9em">${esc(statusPhrase(it))}</span></li>`
  }).join('')
  const html =
    `<div style="font-family:system-ui,sans-serif;color:#2b2417;line-height:1.6">` +
    `<p>${esc(greeting)}</p>` +
    `<p>${n === 1 ? 'One thing on your Wanderlist, for tomorrow:' : `${n} things on your Wanderlist, for tomorrow:`}</p>` +
    `<ul style="padding-left:18px">${htmlItems}</ul>` +
    `<p style="color:#8a7f6a">Catch the ones expiring while you can, and firm up the ones you're still deciding on — or mark anything attended if you already went.</p>` +
    `<p style="color:#8a7f6a">— Wanderlist</p></div>`
  return { subject, text, html }
}
