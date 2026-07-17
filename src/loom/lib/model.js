// ─────────────────────────────────────────────────────────────────────────
// Loom — pure model logic. No React, no network. This is the part that gets
// the heaviest test coverage: the Ivy-Lee heatmap, the fractional manual
// ordering, and the week/grouping maths that both views share.
//
// A thread (task) is:
//   { id, title, skein, day, order, done, pending? }
// where `skein` is the List-view grouping (a project/category string | null),
// `day` is the Weekly-view grouping ('YYYY-MM-DD' local day key | null =
// backlog / unspun), `order` is a fractional manual rank (lower = higher up =
// hotter), and `done` marks a thread woven.
//
// Both views are just different groupings of the SAME thread array — the app's
// single source of truth. Toggling a view never moves data between silos.
// ─────────────────────────────────────────────────────────────────────────

// ── The dye: Ivy-Lee heatmap ────────────────────────────────────────────────
// Threads within a group are sorted by `order`; the top one burns hottest and
// each below fades cooler. Position — not any priority tag — sets the colour.
// The ramp spans the top HEAT_CAP+1 threads (Ivy Lee's "pick six"); anything
// past that falls to a cold, undyed grey, so an overloaded day grows a visible
// grey tail without any hard limit ever being enforced.
export const HEAT_CAP = 5

// Stops from hottest (t=1) to coolest (t=0), as [r,g,b] — dyed-thread colours
// that sit inside Loom's twilight palette: ember → copper → gold → sage → slate.
const HEAT_STOPS = [
  { t: 1.0, c: [214, 69, 47] },   // ember red   #d6452f
  { t: 0.72, c: [217, 138, 43] }, // copper      #d98a2b
  { t: 0.48, c: [201, 164, 76] }, // gold        #c9a44c
  { t: 0.24, c: [111, 158, 122] },// sage        #6f9e7a
  { t: 0.0, c: [74, 109, 116] },  // cool slate  #4a6d74
]
// Undyed overflow — the cold tail past the cap.
const OVERFLOW = [63, 77, 80] // #3f4d50

function lerp(a, b, u) {
  return Math.round(a + (b - a) * u)
}

// Interpolate the ramp at t ∈ [0,1], returning [r,g,b].
export function dyeAt(t) {
  const clamped = Math.max(0, Math.min(1, t))
  // Stops are ordered high→low t; find the segment `clamped` falls in.
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const hi = HEAT_STOPS[i]
    const lo = HEAT_STOPS[i + 1]
    if (clamped <= hi.t && clamped >= lo.t) {
      const span = hi.t - lo.t
      const u = span === 0 ? 0 : (clamped - lo.t) / span
      return [lerp(lo.c[0], hi.c[0], u), lerp(lo.c[1], hi.c[1], u), lerp(lo.c[2], hi.c[2], u)]
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].c
}

// The heat value t for a thread at zero-based `index` within its group. Linear
// from 1 (top) to 0 at HEAT_CAP; clamped past the cap.
export function heatForIndex(index, cap = HEAT_CAP) {
  if (cap <= 0) return 1
  return Math.max(0, 1 - index / cap)
}

// Is this position in the cold overflow tail (past the cap)?
export function isOverflow(index, cap = HEAT_CAP) {
  return index > cap
}

// The CSS colour for a thread's heat edge at `index` within its group.
export function heatColor(index, cap = HEAT_CAP) {
  const rgb = isOverflow(index, cap) ? OVERFLOW : dyeAt(heatForIndex(index, cap))
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

// ── Manual ordering (fractional ranks) ──────────────────────────────────────
// Reordering only ever rewrites the moved thread's rank to the midpoint of its
// new neighbours — never a full renumber — so a drag is one cheap write.
const ORDER_STEP = 1000

export function sortByOrder(threads) {
  return [...threads].sort((a, b) => {
    const ao = a.order ?? 0
    const bo = b.order ?? 0
    if (ao !== bo) return ao - bo
    // Stable tie-break so equal orders (e.g. fresh fixtures) don't jitter.
    return String(a.id).localeCompare(String(b.id))
  })
}

// A rank that sits between two neighbours' orders. Missing neighbour = an end.
export function rankBetween(beforeOrder, afterOrder) {
  const hasBefore = typeof beforeOrder === 'number'
  const hasAfter = typeof afterOrder === 'number'
  if (hasBefore && hasAfter) return (beforeOrder + afterOrder) / 2
  if (hasAfter) return afterOrder - ORDER_STEP
  if (hasBefore) return beforeOrder + ORDER_STEP
  return 0
}

// The rank to give a NEW thread appended to the cool (bottom) end of a group —
// a fresh thread never claims the top spot it hasn't earned. `group` is the
// existing threads of that skein/day (any order).
export function orderForNew(group) {
  if (!group || group.length === 0) return 0
  const max = Math.max(...group.map(t => t.order ?? 0))
  return max + ORDER_STEP
}

// The rank to give `movedId` when dropped at zero-based `targetIndex` within its
// group's on-screen (order-sorted) list. Neighbours are taken from the list with
// the moved thread removed, so indices map directly to gaps.
export function orderForMove(group, movedId, targetIndex) {
  const sorted = sortByOrder(group).filter(t => t.id !== movedId)
  const before = sorted[targetIndex - 1]
  const after = sorted[targetIndex]
  return rankBetween(before?.order, after?.order)
}

// ── Weeks & day keys ────────────────────────────────────────────────────────
// Everything is in the browser's local time; day keys are 'YYYY-MM-DD'.
export function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// Monday-start week. Returns a Date at local midnight of that week's Monday.
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  return addDays(d, -dow)
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// The seven days of the week that `date` falls in, each ready for a column head.
export function weekDays(date) {
  const start = startOfWeek(date)
  return WEEKDAY_LABELS.map((label, i) => {
    const dayDate = addDays(start, i)
    return { key: dateKey(dayDate), date: dayDate, label, dayNum: dayDate.getDate() }
  })
}

export function isSameDay(key, date) {
  return key === dateKey(date)
}

// ── Grouping (the two views over one array) ─────────────────────────────────
// Loose (skein-less) threads collect under this label, shown last in List view.
export const LOOSE_SKEIN = 'Loose threads'

// List view: threads grouped by skein. Returns [{ skein, tasks }] with each
// group's tasks order-sorted. Skein order = first appearance in `threads` (so
// it stays stable as you type), with loose threads always last.
export function groupBySkein(threads) {
  const groups = new Map()
  for (const t of threads) {
    const key = t.skein || LOOSE_SKEIN
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }
  const keys = [...groups.keys()].filter(k => k !== LOOSE_SKEIN)
  if (groups.has(LOOSE_SKEIN)) keys.push(LOOSE_SKEIN)
  return keys.map(skein => ({
    skein,
    isLoose: skein === LOOSE_SKEIN,
    tasks: sortByOrder(groups.get(skein)),
  }))
}

// Every distinct skein name currently in use (for inline suggestions), loose
// excluded. First-appearance order.
export function collectSkeins(threads) {
  const seen = new Set()
  const out = []
  for (const t of threads) {
    if (t.skein && !seen.has(t.skein)) { seen.add(t.skein); out.push(t.skein) }
  }
  return out
}

// Weekly view: threads bucketed by day key for the given week's seven days,
// plus a `backlog` bucket for day-less (or off-week) threads. Each bucket is
// order-sorted. `days` is the output of weekDays().
export function groupByWeek(threads, days) {
  const keys = new Set(days.map(d => d.key))
  const byDay = new Map(days.map(d => [d.key, []]))
  const backlog = []
  for (const t of threads) {
    if (t.day && keys.has(t.day)) byDay.get(t.day).push(t)
    else backlog.push(t)
  }
  const columns = days.map(d => ({ ...d, tasks: sortByOrder(byDay.get(d.key)) }))
  return { columns, backlog: sortByOrder(backlog) }
}

// ── Counts for the status line ──────────────────────────────────────────────
export function threadStats(threads) {
  const total = threads.length
  const woven = threads.filter(t => t.done).length
  return { total, woven, open: total - woven }
}
