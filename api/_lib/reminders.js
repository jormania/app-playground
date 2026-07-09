// Pure logic for the Wanderlist reminder — no network, no env, no Notion — so the rule
// that decides "who gets emailed today, and why" is unit-tested in isolation (mirrors
// api/lib/generatorRotation.js). The cron (api/wanderlist-remind.js) wires this to the
// real Notion query + Resend send.
//
// The rule: an unattended item is due a reminder when, for tomorrow (in the user's
// timezone), it's either Expiring, Planned, or Planned-and-Going — each one gets a
// per-item status label rather than a single generic "expires" line, since the three
// mean different things (a deadline to act vs. something you're actually going to).
//
// A second, weekly rule (selectStaleIdeas): unattended "ideas" — no Planned Date, no Date
// Expiring, added a while ago — get a gentle once-a-week nudge appended to the same email,
// so the someday pile doesn't silently rot.

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

// The local weekday (0 = Sunday … 6 = Saturday) in the given timezone — drives the WEEKLY
// stale-idea nudge (only sent one day a week so it never becomes daily noise).
export function zonedWeekday(now = new Date(), timeZone = 'Europe/Bucharest') {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now)
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
  } catch {
    return now.getUTCDay()
  }
}

// Whole days from `dateKey` up to `todayKey` (how old something is). Both 'YYYY-MM-DD';
// UTC-noon anchored so DST never shifts the count. Null if either key is malformed.
export function daysSince(dateKey, todayKey) {
  const parse = (k) => {
    const [y, m, d] = String(k).split('-').map(Number)
    return (y && m && d) ? Date.UTC(y, m - 1, d, 12) : null
  }
  const a = parse(dateKey), b = parse(todayKey)
  if (a == null || b == null) return null
  return Math.round((b - a) / 86400000)
}

// The "someday pile" worth nudging about: unattended, with no Planned Date and no Date
// Expiring (so they never surface on the calendar or the due-tomorrow digest), added at
// least `minAgeDays` ago — old enough to have quietly slipped your mind. Mirrors the app's
// `isIdea` (search.js), plus the age gate. Pure — the cron supplies mapped rows + today.
export function selectStaleIdeas(entries, todayKey, minAgeDays = 30) {
  return (entries || []).filter(e => {
    if (!e || e.attended || e.plannedDate || e.dateExpiring) return false
    const age = daysSince(e.dateAdded, todayKey)
    return age != null && age >= minAgeDays
  })
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

// 'HH:MM' -> zero-padded 24-hour 'HH:MM' (Romania uses 24h / military time, no am/pm) —
// mirrors src/wanderlist/dates.js's formatTime, duplicated here (not imported) so the cron
// bundle doesn't reach into the Vite src tree. Returns '' for anything not shaped like a time.
export function formatTime24(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''))
  if (!m) return ''
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// The one-line explanation for why an item is in tomorrow's digest — every status it
// carries, joined, so an item that's both expiring and planned the same day says so.
function statusPhrase(it) {
  const parts = []
  if (it.statuses.includes('expiring')) parts.push('expires tomorrow')
  if (it.statuses.includes('going')) {
    parts.push(`you’re going tomorrow${it.plannedTime ? ` at ${formatTime24(it.plannedTime)}` : ''}`)
  } else if (it.statuses.includes('planned')) {
    parts.push(`planned for tomorrow${it.plannedTime ? ` at ${formatTime24(it.plannedTime)}` : ''} — you haven’t said you’re going yet`)
  }
  return parts.join(' · ')
}

// Compose the digest email (subject + plain-text + minimal HTML body). `items` are the
// things due tomorrow (each carrying `statuses` from selectDueTomorrow); `ideas` is the
// optional weekly stale-idea nudge (from selectStaleIdeas) — either list may be empty, but
// the cron only calls this when at least one has something. Pure + presentation-only.
export function buildReminderEmail(items, { name = '', ideas = [] } = {}) {
  const n = items.length
  const ideaN = ideas.length
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

  // Subject: the due items lead when there are any; otherwise it's an ideas-only nudge.
  let subject
  if (n === 1) subject = `Wanderlist: “${items[0].name}” — ${statusPhrase(items[0])}`
  else if (n > 1) subject = `Wanderlist: ${n} things tomorrow`
  else subject = ideaN === 1 ? 'Wanderlist: an idea you haven’t scheduled' : `Wanderlist: ${ideaN} ideas you haven’t scheduled`

  const dueLines = items.map(it => {
    const bits = [`${it.name} — ${statusPhrase(it)}`]
    if (it.place) bits.push(`  ${it.place}`)
    if (it.link) bits.push(`  ${it.link}`)
    return `• ${bits.join('\n')}`
  })
  const ideaLines = ideas.map(it => {
    const bits = [it.name]
    if (it.place) bits.push(`  ${it.place}`)
    if (it.link) bits.push(`  ${it.link}`)
    return `• ${bits.join('\n')}`
  })

  const textParts = [greeting, '']
  if (n > 0) {
    textParts.push(
      n === 1 ? 'One thing on your Wanderlist, for tomorrow:' : `${n} things on your Wanderlist, for tomorrow:`,
      '', ...dueLines, '',
      'Catch the ones expiring while you can, and firm up the ones you\'re still deciding on — or mark anything attended if you already went.',
    )
  }
  if (ideaN > 0) {
    if (n > 0) textParts.push('')
    textParts.push(
      ideaN === 1
        ? 'And one idea that\'s been on your someday list a while, with no date yet:'
        : `And ${ideaN} ideas that have been on your someday list a while, with no date yet:`,
      '', ...ideaLines, '',
      'Worth picking a day for — or letting go of.',
    )
  }
  textParts.push('', '— Wanderlist')
  const text = textParts.join('\n')

  const dueHtmlItems = items.map(it => {
    const title = it.link ? `<a href="${esc(it.link)}">${esc(it.name)}</a>` : esc(it.name)
    const place = it.place ? ` <span style="color:#8a7f6a">— ${esc(it.place)}</span>` : ''
    return `<li style="margin:6px 0">${title}${place}<br><span style="color:#8a7f6a;font-size:0.9em">${esc(statusPhrase(it))}</span></li>`
  }).join('')
  const ideaHtmlItems = ideas.map(it => {
    const title = it.link ? `<a href="${esc(it.link)}">${esc(it.name)}</a>` : esc(it.name)
    const place = it.place ? ` <span style="color:#8a7f6a">— ${esc(it.place)}</span>` : ''
    return `<li style="margin:6px 0">${title}${place}</li>`
  }).join('')
  let html = `<div style="font-family:system-ui,sans-serif;color:#2b2417;line-height:1.6"><p>${esc(greeting)}</p>`
  if (n > 0) {
    html += `<p>${n === 1 ? 'One thing on your Wanderlist, for tomorrow:' : `${n} things on your Wanderlist, for tomorrow:`}</p>` +
      `<ul style="padding-left:18px">${dueHtmlItems}</ul>` +
      `<p style="color:#8a7f6a">Catch the ones expiring while you can, and firm up the ones you're still deciding on — or mark anything attended if you already went.</p>`
  }
  if (ideaN > 0) {
    html += `<p>${ideaN === 1 ? 'And one idea that’s been on your someday list a while, with no date yet:' : `And ${ideaN} ideas that have been on your someday list a while, with no date yet:`}</p>` +
      `<ul style="padding-left:18px">${ideaHtmlItems}</ul>` +
      `<p style="color:#8a7f6a">Worth picking a day for — or letting go of.</p>`
  }
  html += `<p style="color:#8a7f6a">— Wanderlist</p></div>`
  return { subject, text, html }
}
