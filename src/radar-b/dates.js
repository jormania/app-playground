// Temporal reasoning: which lens an event belongs to, and how to say "when" in
// prose. All arithmetic is in the browser's local timezone — this is a Bucharest
// app opened in Bucharest, so local IS Europe/Bucharest, and doing it locally
// avoids a timezone library for a problem that doesn't need one.

export const LENSES = ['tonight', 'tomorrow', 'weekend', 'week', 'later']

const DAY_MS = 86400000

/** These functions are pure and are called from tests and from non-React code
 *  without a translator. Rather than making `t` required everywhere, they fall
 *  back to Romanian — the app's source language — when none is passed. */
const FALLBACK_RO = {
  'date.noDate': 'fără dată',
  'date.today': 'azi',
  'date.tomorrow': 'mâine',
  'date.yesterday': 'ieri',
  'date.daysAgo': 'acum {n} zile',
  'date.until': 'până pe {date}',
  'date.todayHeading': 'Azi',
  'date.tomorrowHeading': 'Mâine',
  'date.noDateHeading': 'Fără dată',
}

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function dayKey(d) {
  const x = new Date(d)
  // Built from local parts, not toISOString() — the latter shifts to UTC and can
  // land a 00:30 Bucharest event on the previous calendar day.
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

function pad(n) { return String(n).padStart(2, '0') }

export function parseDay(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** The last day of the CALENDAR week `now` falls in — Sunday, Monday-start.
 *
 *  "Săptămâna asta" used to mean a rolling seven days (`today + 7`), which on a
 *  Friday swept in the *following* weekend: a festival on the 28th showed under
 *  "this week" when today was the 21st. A calendar week is what the label
 *  actually promises, so on Friday the lens ends on Sunday and next weekend
 *  correctly falls to "Mai încolo". */
export function endOfWeek(now = new Date()) {
  const today = startOfDay(now)
  const dow = today.getDay() // 0 Sun … 6 Sat
  const daysToSunday = dow === 0 ? 0 : 7 - dow
  return new Date(today.getTime() + daysToSunday * DAY_MS)
}

/** The Friday→Sunday window containing or following `now`. During Fri/Sat/Sun it
 *  is the CURRENT weekend, not the next one — asking "what's on this weekend" on
 *  a Saturday must not skip to next Friday. */
export function weekendRange(now = new Date()) {
  const today = startOfDay(now)
  const dow = today.getDay() // 0 Sun … 6 Sat
  let friday
  if (dow === 0) friday = new Date(today.getTime() - 2 * DAY_MS) // Sunday: this weekend started Friday
  else if (dow === 6) friday = new Date(today.getTime() - DAY_MS)
  else friday = new Date(today.getTime() + (5 - dow) * DAY_MS)
  const sunday = new Date(friday.getTime() + 2 * DAY_MS)
  return { from: friday, to: sunday }
}

/** An event's occupied day range as [fromKey, toKey]; null when undated. */
export function spanOf(event) {
  const start = parseDay(event.start)
  if (!start) return null
  const end = parseDay(event.end) || start
  return { from: startOfDay(start), to: startOfDay(end) }
}

function touches(span, from, to) {
  return span.from.getTime() <= to.getTime() && span.to.getTime() >= from.getTime()
}

/** A long run — an exhibition, a months-long installation. These are the events a
 *  date-first stream buries, so they get their own lens rather than appearing
 *  once on their opening day and never again.
 *
 *  The threshold has to make the label TRUE: `long-run` renders as "se vede
 *  oricând" / "see it anytime", it pulls the event out of the day groups into
 *  the `Oricând` section, and it sinks the event's rank — all three of which say
 *  "no hurry". At the old four-day floor a film with a five-day cinema run
 *  qualified, so Radar-B told you to take your time about something leaving in
 *  four days, and buried it under the exhibitions while it did.
 *
 *  Eight days is the honest line, and it states a rule you can check: it is
 *  still on in a week, so it spans another weekend and you really can go some
 *  other day. A weekend festival or a short run stays in the day stream, where
 *  each of its days is a date you might act on. */
export function isLongRun(event, minDays = 8) {
  const span = spanOf(event)
  if (!span) return false
  return (span.to - span.from) / DAY_MS >= minDays - 1
}

export function isRunningNow(event, now = new Date()) {
  const span = spanOf(event)
  if (!span || !isLongRun(event)) return false
  const today = startOfDay(now)
  return span.from <= today && span.to >= today
}

export function isPast(event, now = new Date()) {
  const span = spanOf(event)
  if (!span) return false
  return span.to < startOfDay(now)
}

/** Which temporal lens an event falls under. An event can legitimately answer to
 *  several (a festival running Fri–Sun is in `tonight` on Friday AND `weekend`),
 *  so this returns a SET rather than one bucket — forcing a single answer is what
 *  makes calendar UIs lose things. */
export function lensesFor(event, now = new Date()) {
  const span = spanOf(event)
  const out = new Set()
  if (!span) { out.add('later'); return out } // undated: standing recommendations live at the back
  if (isPast(event, now)) return out

  const today = startOfDay(now)
  const tomorrow = new Date(today.getTime() + DAY_MS)
  const weekend = weekendRange(now)
  const weekEnd = endOfWeek(now)

  if (touches(span, today, today)) out.add('tonight')
  if (touches(span, tomorrow, tomorrow)) out.add('tomorrow')
  if (touches(span, weekend.from, weekend.to)) out.add('weekend')
  if (touches(span, today, weekEnd)) out.add('week')
  if (span.to > weekEnd) out.add('later')
  return out
}

// Month and weekday names per language. Kept here rather than in i18n.js because
// they're indexed by Date.getMonth()/getDay() — an ordered array, not a lookup of
// named keys — and because `formatWhen` needs them synchronously in pure code
// that has no React context to read from.
const MONTHS = {
  ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
    'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
}
const DAYS = {
  ro: ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/** English writes "3 September" the same way Romanian writes "3 septembrie", so
 *  one day-then-month order serves both — no per-language date grammar needed. */
function months(lang) { return MONTHS[lang] ?? MONTHS.ro }
function days(lang) { return DAYS[lang] ?? DAYS.ro }

export function formatTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getHours())}:${pad(d.getMinutes())}` // 24h — Romania doesn't use am/pm
}

/** "When" as a human would say it, never as a database would print it. Precision
 *  is only ever as high as the underlying data: no time means no time shown. */
export function formatWhen(event, now = new Date(), t = null) {
  const tr = t ?? ((k, v) => (FALLBACK_RO[k] ?? k).replace('{date}', v?.date ?? ''))
  const lang = tr('__lang__') === '__lang__' ? 'ro' : tr('__lang__')
  const span = spanOf(event)
  if (!span) return tr('date.noDate')

  const today = startOfDay(now)
  const time = event.hasTime && event.start ? formatTime(event.start) : null
  const multiDay = span.to > span.from

  if (multiDay) {
    const running = span.from <= today && span.to >= today
    if (running) return tr('date.until', { date: dayMonth(span.to, lang) })
    return `${dayMonth(span.from, lang)} – ${dayMonth(span.to, lang)}`
  }

  const daysOut = Math.round((span.from - today) / DAY_MS)
  let label
  if (daysOut === 0) label = tr('date.today')
  else if (daysOut === 1) label = tr('date.tomorrow')
  else if (daysOut > 1 && daysOut < 7) label = days(lang)[span.from.getDay()]
  else label = dayMonth(span.from, lang)
  return time ? `${label}, ${time}` : label
}

export function dayMonth(d, lang = 'ro') {
  return `${d.getDate()} ${months(lang)[d.getMonth()]}`
}

/** Heading for a day group in the stream. */
export function dayHeading(key, now = new Date(), t = null) {
  const tr = t ?? ((k) => FALLBACK_RO[k] ?? k)
  const lang = tr('__lang__') === '__lang__' ? 'ro' : tr('__lang__')
  const d = parseDay(key)
  if (!d) return tr('date.noDateHeading')
  const daysOut = Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS)
  if (daysOut === 0) return `${tr('date.todayHeading')} · ${dayMonth(d, lang)}`
  if (daysOut === 1) return `${tr('date.tomorrowHeading')} · ${dayMonth(d, lang)}`
  return `${cap(days(lang)[d.getDay()])} · ${dayMonth(d, lang)}`
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

/** How stale a row is, in days since it was last verified. Null when never
 *  checked — "unknown" and "fresh" must not render the same. */
export function stalenessDays(event, now = new Date()) {
  const checked = parseDay(event.checked)
  if (!checked) return null
  return Math.max(0, Math.round((startOfDay(now) - checked) / DAY_MS))
}

export function relativeDays(n, t = null) {
  const tr = t ?? ((k, v) => (FALLBACK_RO[k] ?? k).replace('{n}', v?.n ?? ''))
  if (n === null || n === undefined) return null
  if (n === 0) return tr('date.today')
  if (n === 1) return tr('date.yesterday')
  return tr('date.daysAgo', { n })
}
