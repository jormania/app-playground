// Temporal reasoning: which lens an event belongs to, and how to say "when" in
// prose. All arithmetic is in the browser's local timezone — this is a Bucharest
// app opened in Bucharest, so local IS Europe/Bucharest, and doing it locally
// avoids a timezone library for a problem that doesn't need one.

export const LENSES = ['tonight', 'tomorrow', 'weekend', 'week', 'later']

const DAY_MS = 86400000

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
 *  once on their opening day and never again. */
export function isLongRun(event, minDays = 4) {
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
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS)

  if (touches(span, today, today)) out.add('tonight')
  if (touches(span, tomorrow, tomorrow)) out.add('tomorrow')
  if (touches(span, weekend.from, weekend.to)) out.add('weekend')
  if (touches(span, today, weekEnd)) out.add('week')
  if (span.to > weekEnd) out.add('later')
  return out
}

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
const RO_DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']

export function formatTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getHours())}:${pad(d.getMinutes())}` // 24h — Romania doesn't use am/pm
}

/** "When" as a human would say it, never as a database would print it. Precision
 *  is only ever as high as the underlying data: no time means no time shown. */
export function formatWhen(event, now = new Date()) {
  const span = spanOf(event)
  if (!span) return 'fără dată'

  const today = startOfDay(now)
  const time = event.hasTime && event.start ? formatTime(event.start) : null
  const multiDay = span.to > span.from

  if (multiDay) {
    const running = span.from <= today && span.to >= today
    if (running) return `până pe ${dayMonth(span.to)}`
    return `${dayMonth(span.from)} – ${dayMonth(span.to)}`
  }

  const daysOut = Math.round((span.from - today) / DAY_MS)
  let label
  if (daysOut === 0) label = 'azi'
  else if (daysOut === 1) label = 'mâine'
  else if (daysOut > 1 && daysOut < 7) label = RO_DAYS[span.from.getDay()]
  else label = dayMonth(span.from)
  return time ? `${label}, ${time}` : label
}

export function dayMonth(d) {
  return `${d.getDate()} ${RO_MONTHS[d.getMonth()]}`
}

/** Heading for a day group in the stream. */
export function dayHeading(key, now = new Date()) {
  const d = parseDay(key)
  if (!d) return 'Fără dată'
  const daysOut = Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS)
  if (daysOut === 0) return `Azi · ${dayMonth(d)}`
  if (daysOut === 1) return `Mâine · ${dayMonth(d)}`
  return `${cap(RO_DAYS[d.getDay()])} · ${dayMonth(d)}`
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

/** How stale a row is, in days since it was last verified. Null when never
 *  checked — "unknown" and "fresh" must not render the same. */
export function stalenessDays(event, now = new Date()) {
  const checked = parseDay(event.checked)
  if (!checked) return null
  return Math.max(0, Math.round((startOfDay(now) - checked) / DAY_MS))
}

export function relativeDays(days) {
  if (days === null || days === undefined) return null
  if (days === 0) return 'azi'
  if (days === 1) return 'ieri'
  return `acum ${days} zile`
}
