// Date helpers — all local-time, all pure. Wanderlist's spine is the "Date Expiring"
// deadline: when a registration/ticket window or run closes. Everything is a stable
// local YYYY-MM-DD key so we never hit the UTC-midnight shift that `new Date('...')`
// and toISOString() cause west of Greenwich.

// Local YYYY-MM-DD for a Date.
export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Parse a 'YYYY-MM-DD' key into a local Date at midnight.
export function keyToDate(key) {
  if (!key || typeof key !== 'string') return null
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// "Tuesday, 24 June 2026" — detail view.
export function formatHuman(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// "24 Jun" — compact list label.
export function formatShort(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

// "24 Jun 2026" — compact but year-unambiguous.
export function formatMedium(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

// Whole days from `today` until `key` (negative = already past). Both are floored to
// local midnight so the count is a clean number of calendar days, not hours.
export function daysUntil(key, today = todayKey()) {
  const a = keyToDate(today)
  const b = keyToDate(key)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Human phrasing of an expiry date relative to today: "expires today", "expires
// tomorrow", "expires in 5 days", "expired yesterday", "expired 3 days ago".
// Returns '' when there's no expiry date.
export function expiryLabel(key, today = todayKey()) {
  const n = daysUntil(key, today)
  if (n == null) return ''
  if (n === 0) return 'expires today'
  if (n === 1) return 'expires tomorrow'
  if (n > 1) return `expires in ${n} days`
  if (n === -1) return 'expired yesterday'
  return `expired ${-n} days ago`
}

// "Expiring soon" = an unattended item whose deadline is within `days` from today
// (inclusive) and not already past. Drives the top-of-list float and the quick filter.
export function isExpiringSoon(entry, { today = todayKey(), days = 14 } = {}) {
  if (!entry || entry.attended || !entry.dateExpiring) return false
  const n = daysUntil(entry.dateExpiring, today)
  return n != null && n >= 0 && n <= days
}

// The item on a given date, or null (used sparingly; Wanderlist has no one-per-date rule).
export function findByDate(entries, key) {
  return (entries || []).find(e => e && e.dateExpiring === key) || null
}

// ── Calendar (M2) ─────────────────────────────────────────────────────────────
export function monthLabel(year, month) {
  return `${MONTHS[month]} ${year}`
}

// Build a month grid: an array of weeks, each a 7-cell row. `weekStart` is 0 (Sunday)
// or 1 (Monday). Leading/trailing days from neighbouring months keep the grid
// rectangular, flagged `inMonth: false`. (Ported from Journal of Delights.)
export function monthGrid(year, month, weekStart = 1) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() - weekStart + 7) % 7
  const weeks = []
  let cursor = new Date(year, month, 1 - startOffset)
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      row.push({ key: todayKey(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    weeks.push(row)
  }
  while (weeks.length > 4 && weeks[weeks.length - 1].every(c => !c.inMonth)) weeks.pop()
  return weeks
}

// Step a month {year, month} forward or backward, for calendar nav.
export function stepMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

// Which of an entry's calendar dates fall on `key`. Returns { planned, expiring } booleans —
// the two marker roles a day box can show.
export function rolesOn(entry, key) {
  return {
    planned: Boolean(entry && entry.plannedDate === key),
    expiring: Boolean(entry && entry.dateExpiring === key),
  }
}

// Entries touching a given day (by Planned Date or Date Expiring), each tagged with which
// role(s) matched — the source for the day's agenda panel. Planned matches first.
export function entriesOnDay(entries, key) {
  return (entries || [])
    .map(e => ({ entry: e, ...rolesOn(e, key) }))
    .filter(r => r.planned || r.expiring)
    .sort((a, b) => (a.planned === b.planned ? 0 : a.planned ? -1 : 1))
}
