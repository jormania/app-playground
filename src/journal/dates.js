// Date helpers — all local-time, all pure. The journal's one hard rule is
// "one entry per calendar date", so a stable local YYYY-MM-DD key is the spine
// of the whole app: it's how we match today, dedupe, and lay out the calendar.

// Local YYYY-MM-DD for a Date (NOT toISOString, which is UTC and shifts the day
// across midnight for anyone west of Greenwich).
export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Parse a 'YYYY-MM-DD' key into a local Date at midnight (again avoiding the UTC
// trap of `new Date('2026-06-24')`, which is parsed as UTC).
export function keyToDate(key) {
  if (!key || typeof key !== 'string') return null
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// "Tuesday, 24 June 2026" — for the single-entry view and editor header.
export function formatHuman(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// "24 Jun" — compact label for list rows.
export function formatShort(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export function monthLabel(year, month) {
  return `${MONTHS[month]} ${year}`
}

// The entry on a given date key, or null. (One-per-date means at most one.)
export function findByDate(entries, key) {
  return (entries || []).find(e => e && e.date === key) || null
}

export function hasEntryOn(entries, key) {
  return Boolean(findByDate(entries, key))
}

// Reverse-chronological sort (newest first) — the primary list order.
export function sortByDateDesc(entries) {
  return [...(entries || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

// Build a month grid for the calendar view: an array of weeks, each a 7-cell row.
// `weekStart` is 0 (Sunday) or 1 (Monday). Leading/trailing days from neighbouring
// months are included so the grid is always rectangular, flagged `inMonth: false`.
export function monthGrid(year, month, weekStart = 0) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() - weekStart + 7) % 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const weeks = []
  let cursor = gridStart
  // 6 rows covers every month layout; trim trailing all-out-of-month rows below.
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      row.push({
        key: todayKey(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
      })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    weeks.push(row)
  }
  while (weeks.length > 4 && weeks[weeks.length - 1].every(c => !c.inMonth)) weeks.pop()
  return weeks
}

// Step a month key (year/month object) forward or backward, for calendar nav.
export function stepMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
