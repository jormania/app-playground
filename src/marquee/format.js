// Date and label formatting. Kept out of the components so the wording is in one
// place and testable — "tonight" being wrong is the kind of thing that quietly
// erodes trust in everything else the app says.

const DAY = 86400000

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDay(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key ?? ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Before this, today is still "today"; from it on, it is "tonight". Anything
// this side of late afternoon is a matinee, and calling an 11:00 screening
// "Tonight" is exactly the small, confident inaccuracy that makes someone stop
// believing the rest of what the app says.
const EVENING = '17:00'

/** "Tonight", "Tomorrow", "Sat 5 Sep" — and, with `relative`, a past-facing
 *  "yesterday" / "on 22 Aug" for when a scan last ran.
 *
 *  `time` (`HH:MM`) is optional and only ever consulted for TODAY: a specific
 *  showing that starts in the morning reads "Today", while a label standing for
 *  a whole day — a date heading, with no one time behind it — keeps "Tonight". */
export function formatDay(key, { now = new Date(), relative = false, time = null } = {}) {
  const date = parseDay(key)
  if (!date) return ''
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY)

  if (relative) {
    if (days === 0) return 'earlier today'
    if (days === -1) return 'yesterday'
    if (days > -7 && days < 0) return date.toLocaleDateString('en-GB', { weekday: 'long' })
    return `on ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }

  if (days === 0) return time && time < EVENING ? 'Today' : 'Tonight'
  if (days === 1) return 'Tomorrow'
  if (days > 1 && days < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' })
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** The date line under a production: one date, a range, or a count.
 *
 *  A run with more than one showing but only one distinct CALENDAR DATE (two
 *  sittings the same night, say) is neither of the things "N dates · first –
 *  last" claims: not a range (there's nothing to span) and not really
 *  several dates either — "Thu 3 Sept – 3 Sept" is what that phrasing does to
 *  it. Named as showings instead, and without a redundant same-day range. */
export function formatRun(production) {
  const { showings } = production
  if (!showings?.length) return ''
  const first = formatDay(showings[0].date)
  if (showings.length === 1) {
    const only = formatDay(showings[0].date, { time: showings[0].time })
    return showings[0].time ? `${only} · ${showings[0].time}` : only
  }
  if (production.firstDate === production.lastDate) {
    return `${showings.length} showings · ${first}`
  }
  const last = parseDay(production.lastDate)
  const lastLabel = last ? last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  return `${showings.length} dates · ${first} – ${lastLabel}`
}

export function formatPrice(value) {
  if (value == null) return null
  if (value === 0) return 'Free'
  return `${value} lei`
}
