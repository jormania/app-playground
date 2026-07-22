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

// ── Carry-over (the re-warp ritual) ─────────────────────────────────────────
// 0 = Monday … 6 = Sunday, from a 'YYYY-MM-DD' day key (parsed local).
export function weekdayIndex(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

// The unfinished threads left hanging from *before* the given week — anything
// dated strictly earlier than this week's Monday and not yet woven. Day keys are
// 'YYYY-MM-DD', so a lexical compare is a date compare. Sorted oldest-first, then
// by manual order, so the ritual walks them in a natural sequence.
export function carryThreads(threads, weekStartKey) {
  return threads
    .filter(t => t.day && !t.done && t.day < weekStartKey)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.order ?? 0) - (b.order ?? 0)))
}

// ── Drafts (recurring weaves) ────────────────────────────────────────────────
// A draft is a saved set of threads with a day-of-week (0–6) or null (distaff).
// Casting it onto a week turns each item into a real thread on that week's dates.
export function threadsForDraftWeek(draft, weekStartDate) {
  const start = startOfWeek(weekStartDate)
  return (draft?.items || []).map((it, i) => ({
    title: it.title,
    skein: it.skein || null,
    day: typeof it.dayIndex === 'number' ? dateKey(addDays(start, it.dayIndex)) : null,
    order: typeof it.order === 'number' ? it.order : i * 1000,
    done: false,
  }))
}

// Snapshot a week's open threads as draft items (day → day-of-week index, or null
// for distaff). Woven threads and off-week dates are left out. If `excludeSkein`
// is set, threads from those skeins are filtered out — used to keep all rhythm
// threads out of draft snapshots (they're placed by the rhythm, not by drafts).
// `excludeSkeins` is a Set (or array) of skein names.
export function draftItemsFromWeek(threads, days, { excludeSkeins } = {}) {
  const skipSet = excludeSkeins instanceof Set ? excludeSkeins : new Set(excludeSkeins || [])
  const keyToIndex = new Map(days.map((d, i) => [d.key, i]))
  return sortByOrder(threads.filter(t => {
    if (t.done) return false
    if (skipSet.size > 0 && skipSet.has(t.skein)) return false
    return t.day == null || keyToIndex.has(t.day)
  }))
    .map(t => ({
      title: t.title,
      skein: t.skein || null,
      dayIndex: keyToIndex.has(t.day) ? keyToIndex.get(t.day) : null,
      order: t.order ?? 0,
    }))
}

// ── Rhythm (daily routine) ───────────────────────────────────────────────────
// Multiple skeins can be flagged as rhythms. Each rhythm entry is { skeinName, days }
// where `days` is a weekday-index mask (0=Mon…6=Sun, null = all seven days).
// `rhythmThreadsForWeek` processes every entry and returns the combined list of
// threads to create. `splitRhythmThreads` partitions a day's task list into the
// rhythm block (top) and the rest using a Set of rhythm skein names.

// Build threads to create when casting all rhythms onto a week.
// `rhythms` is Array<{ skeinName, days }>.
// Returns Array<{ title, skein, day, order, done }> — dup-guarded per skein per day.
export function rhythmThreadsForWeek(threads, rhythms, days) {
  if (!rhythms || rhythms.length === 0) return []
  const result = []
  for (const { skeinName, days: daysMask } of rhythms) {
    // Canonical templates: unique titles from undone threads in this skein.
    const canonical = sortByOrder(threads.filter(t => t.skein === skeinName && !t.done))
    const seen = new Set()
    const templates = []
    for (const t of canonical) {
      if (!seen.has(t.title)) { seen.add(t.title); templates.push(t) }
    }
    if (templates.length === 0) continue

    const activeDays = daysMask
      ? days.filter((_, i) => daysMask.includes(i))
      : days

    for (const day of activeDays) {
      const existing = new Set(
        threads.filter(t => t.day === day.key && t.skein === skeinName).map(t => t.title)
      )
      for (const tpl of templates) {
        if (!existing.has(tpl.title)) {
          result.push({ title: tpl.title, skein: skeinName, day: day.key, order: tpl.order ?? 0, done: false })
        }
      }
    }
  }
  return result
}

// Split a day's order-sorted task list into { rhythm, rest } so the week view
// can render the rhythm block at the top with a visual separator.
// `rhythmNames` is a Set<string> of all rhythm skein names.
export function splitRhythmThreads(tasks, rhythmNames) {
  if (!rhythmNames || rhythmNames.size === 0) return { rhythm: [], rest: tasks }
  const rhythm = []
  const rest = []
  for (const t of tasks) {
    if (rhythmNames.has(t.skein)) rhythm.push(t)
    else rest.push(t)
  }
  return { rhythm, rest }
}

// Threads dated this week or later, or day-less — i.e. everything EXCEPT
// genuinely stale debt from a week that's already passed. Shared by the
// rhythm template count (Skeins view) and the rhythm heat-rank derivation (The
// Warp) so both agree on the same "current" scope: a rhythm cast ahead onto a
// future week still counts (it's real, upcoming work), but an abandoned
// instance from three weeks ago — never woven, never carried over — doesn't
// pad the number forever. Stale past debt is the Re-warp ritual's job, not a
// reason for a Skeins-view count to keep climbing across every week the app
// has ever been used.
export function currentOrFutureThreads(threads, weekStartKey) {
  return threads.filter(t => !t.day || t.day >= weekStartKey)
}

// Consolidate a rhythm skein's exploded per-day instances (one real thread per
// cast day) into one row per unique canonical title — what the Skeins view
// shows for a rhythm skein, instead of the same "Deep work" repeated once for
// every day it's been woven onto. Order is the lowest `order` among threads
// sharing that title (so a template's position tracks whichever instance
// Loom would currently offer as the cast template); `count` and `instanceIds`
// carry every matching thread so the caller can act on the whole group at
// once (rename / delete / reorder), regardless of done-state — a rhythm
// template deliberately doesn't distinguish "some instances are woven". Pass
// an already-scoped `tasks` array (see `currentOrFutureThreads`) if stale past
// instances shouldn't inflate the count — this function itself is a pure
// consolidation, agnostic of any date scoping.
export function rhythmTemplateGroups(tasks) {
  const byTitle = new Map()
  for (const t of tasks) {
    const key = t.title
    const existing = byTitle.get(key)
    if (!existing) {
      byTitle.set(key, { title: t.title, skein: t.skein, order: t.order ?? 0, count: 1, instanceIds: [t.id] })
    } else {
      existing.count++
      existing.instanceIds.push(t.id)
      if ((t.order ?? 0) < existing.order) existing.order = t.order ?? 0
    }
  }
  return [...byTitle.values()].sort((a, b) => a.order - b.order)
}

// A rhythm thread's heat rank is FIXED per (skein, title) — matching its
// position in the Skeins view's own consolidated template order — and applied
// identically to every instance of that thread across every day it's cast to.
// Turning a thread "red" (hottest) in the Skeins list makes it red everywhere
// in The Warp, on whichever days it's on, regardless of each day's own local
// thread order. Scoped to `weekStartKey` onward via `currentOrFutureThreads`,
// so the ranks always match what the Skeins view itself currently shows for
// each rhythm skein. Returns a Map keyed by a joined skein+title pair (not a
// plain space or any other printable separator, which a real skein/title
// could contain and risk a collision) to a zero-based rank; look it up with
// `rhythmHeatRankFor`.
const HEAT_RANK_SEP = String.fromCharCode(0)
function heatRankKey(skein, title) { return skein + HEAT_RANK_SEP + title }

export function rhythmTemplateHeatRanks(threads, rhythmSkeinNames, weekStartKey) {
  const ranks = new Map()
  if (!rhythmSkeinNames || rhythmSkeinNames.size === 0) return ranks
  const scoped = currentOrFutureThreads(threads, weekStartKey)
  for (const skeinName of rhythmSkeinNames) {
    const templates = rhythmTemplateGroups(scoped.filter(t => t.skein === skeinName))
    templates.forEach((tpl, i) => ranks.set(heatRankKey(skeinName, tpl.title), i))
  }
  return ranks
}

// Look up a thread's fixed heat rank from `rhythmTemplateHeatRanks`'s map,
// falling back to 0 (hottest) for a thread the map doesn't know about yet
// (e.g. a title just renamed, not yet re-scanned).
export function rhythmHeatRankFor(ranks, thread) {
  return ranks.get(heatRankKey(thread.skein, thread.title)) ?? 0
}

// ── Rhythm history (last 7 days, today inclusive) ───────────────────────────
// A per-thread streak strip, read the same descriptive way as the Tapestry (no
// scoring, no streak counts) — for each rhythm template (consolidated exactly
// like the Skeins view's rhythmTemplateGroups), the last 7 calendar days as day
// cells, each marked:
//   'done' — an instance exists for that day and is woven
//   'open' — an instance exists and isn't woven yet (the Tapestry's own "open")
//   'none' — the day is inside the rhythm's pattern but nothing was ever cast
//   'off'  — the day sits outside the rhythm's day mask (not a rhythm day)
// A template only appears once something with its title exists within the
// window (or is day-less) — a stale, long-abandoned title never resurfaces.
export function rhythmLast7Days(threads, rhythms, { now = new Date() } = {}) {
  if (!rhythms || rhythms.length === 0) return []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = addDays(today, -6)
  const windowStartKey = dateKey(start)
  const cellDates = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const out = []
  for (const { skeinName, days: daysMask } of rhythms) {
    const skeinThreads = threads.filter(t => t.skein === skeinName)
    const scoped = skeinThreads.filter(t => !t.day || t.day >= windowStartKey)
    const templates = rhythmTemplateGroups(scoped)
    for (const tpl of templates) {
      const cells = cellDates.map(d => {
        const key = dateKey(d)
        const dayIndex = weekdayIndex(key)
        const label = WEEKDAY_LABELS[dayIndex]
        const dayNum = d.getDate()
        if (daysMask && !daysMask.includes(dayIndex)) {
          return { key, label, dayNum, status: 'off' }
        }
        const inst = skeinThreads.find(t => t.title === tpl.title && t.day === key)
        return { key, label, dayNum, status: !inst ? 'none' : (inst.done ? 'done' : 'open') }
      })
      out.push({ skeinName, title: tpl.title, cells })
    }
  }
  return out
}

// ── Search & focus ───────────────────────────────────────────────────────────
export function matchesQuery(thread, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true
  return `${thread.title || ''} ${thread.skein || ''}`.toLowerCase().includes(q)
}

// The "hot few" of an order-sorted group — the top HEAT_CAP+1 (Ivy Lee's six).
export function topOfGroup(tasks, cap = HEAT_CAP) {
  return tasks.slice(0, cap + 1)
}

// Skein-group ordering in List view (row order within a group is always manual).
// 'manual' keeps first-appearance order or respects `skeinOrder` when provided
// (a saved drag-order array). Loose threads stay last in every mode.
export function sortSkeinGroups(groups, mode = 'manual', skeinOrder = []) {
  const openCount = g => g.tasks.filter(t => !t.done).length
  const arr = [...groups]
  if (mode === 'name') arr.sort((a, b) => (a.isLoose - b.isLoose) || a.skein.localeCompare(b.skein))
  else if (mode === 'size') arr.sort((a, b) => (a.isLoose - b.isLoose) || (b.tasks.length - a.tasks.length))
  else if (mode === 'heat') arr.sort((a, b) => (a.isLoose - b.isLoose) || (openCount(b) - openCount(a)))
  else if (mode === 'manual' && skeinOrder.length > 0) {
    const pos = new Map(skeinOrder.map((name, i) => [name, i]))
    arr.sort((a, b) => {
      if (a.isLoose !== b.isLoose) return a.isLoose - b.isLoose
      const ai = pos.has(a.skein) ? pos.get(a.skein) : Infinity
      const bi = pos.has(b.skein) ? pos.get(b.skein) : Infinity
      return ai - bi
    })
  }
  return arr
}


// ── The Tapestry (descriptive history — never scored or streaked) ────────────
// An N-week heatmap over Day+Done: for each day cell, how many threads sit there
// and how many are woven. Plus completion rate, the hottest skein, the busiest
// weekday, and what's still unwoven from past weeks — all read across every
// thread regardless of the week the app is currently showing.
export function tapestryStats(threads, { weeks = 8, now = new Date() } = {}) {
  const thisMonday = startOfWeek(now)
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1))
  const windowStartKey = dateKey(firstMonday)
  const windowEndKey = dateKey(addDays(thisMonday, 6))

  const rows = []
  const cellByKey = new Map()
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(firstMonday, 7 * w)
    const dayCells = WEEKDAY_LABELS.map((label, i) => {
      const cell = { key: dateKey(addDays(monday, i)), dayIndex: i, total: 0, woven: 0 }
      cellByKey.set(cell.key, cell)
      return cell
    })
    rows.push({ weekStartKey: dateKey(monday), monday, days: dayCells })
  }

  let total = 0
  let woven = 0
  const bySkein = new Map()
  const byWeekday = new Array(7).fill(0)
  for (const t of threads) {
    if (!t.day || t.day < windowStartKey || t.day > windowEndKey) continue
    total++
    if (t.done) woven++
    const cell = cellByKey.get(t.day)
    if (cell) { cell.total++; if (t.done) cell.woven++ }
    const sk = t.skein || LOOSE_SKEIN
    const rec = bySkein.get(sk) || { skein: sk, total: 0, woven: 0 }
    rec.total++; if (t.done) rec.woven++
    bySkein.set(sk, rec)
    byWeekday[weekdayIndex(t.day)]++
  }

  let hottestSkein = null
  for (const rec of bySkein.values()) {
    if (!hottestSkein || rec.total > hottestSkein.total) hottestSkein = rec
  }
  let busyIdx = -1
  let busyMax = 0
  byWeekday.forEach((n, i) => { if (n > busyMax) { busyMax = n; busyIdx = i } })

  const thisMondayKey = dateKey(thisMonday)
  const unwovenPast = threads.filter(t => t.day && !t.done && t.day < thisMondayKey).length
  const maxWoven = rows.reduce((m, r) => r.days.reduce((mm, c) => Math.max(mm, c.woven), m), 0)

  return {
    rows,
    weeks,
    total,
    woven,
    completionRate: total ? woven / total : 0,
    hottestSkein,
    busiestWeekday: busyMax > 0 ? { index: busyIdx, label: WEEKDAY_LABELS[busyIdx], count: busyMax } : null,
    unwovenPast,
    maxWoven,
  }
}

// The lightweight end-of-week review — the no-server version of the Tapestry for
// a single week: N woven, M still open (carried), and its hottest skein.
export function weekReview(threads, weekStartDate) {
  const start = startOfWeek(weekStartDate)
  const startKey = dateKey(start)
  const endKey = dateKey(addDays(start, 6))
  let woven = 0
  let open = 0
  const bySkein = new Map()
  for (const t of threads) {
    if (!t.day || t.day < startKey || t.day > endKey) continue
    if (t.done) woven++; else open++
    const sk = t.skein || LOOSE_SKEIN
    bySkein.set(sk, (bySkein.get(sk) || 0) + 1)
  }
  let hottestSkein = null
  let max = 0
  for (const [sk, n] of bySkein) if (n > max) { max = n; hottestSkein = sk }
  return { woven, carried: open, hottestSkein }
}
