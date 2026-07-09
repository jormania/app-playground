// Pure logic for the Wanderlist expiry reminder — no network, no env, no Notion — so
// the rule that decides "who gets emailed today" is unit-tested in isolation (mirrors
// api/lib/generatorRotation.js). The cron (api/wanderlist-remind.js) wires this to the
// real Notion query + Resend send.
//
// The one rule: an item is due a reminder when its Date Expiring is *tomorrow* (in the
// user's timezone) and it hasn't been marked Attended.

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

// The items that should trigger a reminder today: unattended AND expiring on the given
// day key. Pure — the caller supplies both the mapped items and the target key.
export function selectExpiring(entries, tomorrowKey) {
  if (!tomorrowKey) return []
  return (entries || []).filter(e => e && !e.attended && e.dateExpiring === tomorrowKey)
}

// Compose the digest email (subject + plain-text + minimal HTML body) for a batch of
// expiring items. Pure and presentation-only; the cron just hands the result to Resend.
// (Callers also pass a `tomorrowKey` in the options — accepted and ignored; the copy
// says "tomorrow" in prose rather than printing the date.)
export function buildReminderEmail(items, { name = '' } = {}) {
  const n = items.length
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const subject = n === 1
    ? `Wanderlist: “${items[0].name}” expires tomorrow`
    : `Wanderlist: ${n} things expire tomorrow`
  const lines = items.map(it => {
    const bits = [it.name]
    if (it.place) bits.push(`— ${it.place}`)
    return `• ${bits.join(' ')}${it.link ? `\n  ${it.link}` : ''}`
  })
  const text = [
    greeting,
    '',
    n === 1
      ? 'One thing on your Wanderlist closes tomorrow:'
      : `${n} things on your Wanderlist close tomorrow:`,
    '',
    ...lines,
    '',
    'Catch them while you can — or mark them attended if you already have.',
    '',
    '— Wanderlist',
  ].join('\n')
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const htmlItems = items.map(it => {
    const title = it.link ? `<a href="${esc(it.link)}">${esc(it.name)}</a>` : esc(it.name)
    const place = it.place ? ` <span style="color:#8a7f6a">— ${esc(it.place)}</span>` : ''
    return `<li style="margin:6px 0">${title}${place}</li>`
  }).join('')
  const html =
    `<div style="font-family:system-ui,sans-serif;color:#2b2417;line-height:1.6">` +
    `<p>${esc(greeting)}</p>` +
    `<p>${n === 1 ? 'One thing on your Wanderlist closes tomorrow:' : `${n} things on your Wanderlist close tomorrow:`}</p>` +
    `<ul style="padding-left:18px">${htmlItems}</ul>` +
    `<p style="color:#8a7f6a">Catch them while you can — or mark them attended if you already have.</p>` +
    `<p style="color:#8a7f6a">— Wanderlist</p></div>`
  return { subject, text, html }
}
