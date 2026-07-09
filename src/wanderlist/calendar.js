// Build a Google Calendar "create event" URL prefilled from an entry. Opening the URL
// always lands on Google's own event editor — a link can't save an event silently — so:
//   • a fully-specified entry (Planned Date + start time, marked Going) arrives as a timed
//     block, one tap from saved;
//   • a vaguer one (a planned day but no time, or a bare idea with no date at all) arrives
//     with everything we DO know filled in and the date/time left for you to set and verify,
//     which is exactly the "stop and let me complete it" behaviour we want there.
// Google-specific by request (you use Google Calendar), but the shape — title/dates/
// details/location — is the de-facto template every calendar's web import understands.

// 'YYYYMMDDTHHMMSSZ' (UTC) for a Date — Google Calendar's timed `dates` format.
function toGCalUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// All-day `dates` value for a 'YYYY-MM-DD' key: 'YYYYMMDD/YYYYMMDD' where the end is the
// NEXT day (Google treats the all-day end as exclusive, so a single day is start→start+1).
function allDayRange(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  if (!y || !m || !d) return null
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 1)
  const fmt = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`
  return `${fmt(start)}/${fmt(end)}`
}

// The `dates` query value, or null when we shouldn't prefill one (no planned date — let you
// pick it in Google's editor). A planned date WITH a start time → a timed block of
// `durationHours` (default 2h), expressed in UTC (the browser converts the local wall-clock
// time you picked); a planned date with no time → an all-day event. Pure + exported so the
// date maths is unit-testable without a DOM.
export function calendarDates(entry, { durationHours = 2 } = {}) {
  const e = entry || {}
  if (!e.plannedDate) return null
  if (e.plannedTime) {
    const start = new Date(`${e.plannedDate}T${e.plannedTime}`)
    if (Number.isNaN(start.getTime())) return allDayRange(e.plannedDate)
    const end = new Date(start.getTime() + durationHours * 3600 * 1000)
    return `${toGCalUtc(start)}/${toGCalUtc(end)}`
  }
  return allDayRange(e.plannedDate)
}

// The full Google Calendar template URL. `text` (title), `details` (description + link),
// `location` (place) are always filled from whatever the entry has; `dates` is only added
// when calendarDates() returns one.
export function googleCalendarUrl(entry, opts = {}) {
  const e = entry || {}
  const params = new URLSearchParams({ action: 'TEMPLATE' })
  params.set('text', e.name || 'Untitled')
  const details = []
  if (e.description) details.push(e.description)
  if (e.link) details.push(e.link)
  if (details.length) params.set('details', details.join('\n\n'))
  if (e.place) params.set('location', e.place)
  const dates = calendarDates(e, opts)
  if (dates) params.set('dates', dates)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
