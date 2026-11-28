import type { PracticeEntry, SeriesDef, SeriesProgress, Session } from '../domain/types'
import { fold } from './filter'
import { daysBetween } from './recommend'
import { searchUrl } from './youtube'

/**
 * Series arithmetic: which catalogue session is which day, which days are done,
 * where you are, and how the run is going. Pure functions over the definition,
 * your progress record, the catalogue and practice history.
 *
 * A day counts as done in the current run when you ticked it by hand, or when
 * its linked session appears in practice history on or after the day you
 * started (and, for a finished run, on or before the day it ended). So a series
 * picks up practice you recorded anywhere in the app, with no double entry.
 */

const DAY_RE = /\b(?:day|week)\s*(\d{1,2})\b/i

/** Day number from a session: `seriesDay` first, then "Day 8" / "Week 2" in the title. */
export function dayOf(s: Session): number | null {
  if (s.seriesDay && s.seriesDay > 0) return s.seriesDay
  const m = s.title.match(DAY_RE)
  return m ? Number(m[1]) : null
}

/** Does `session.series` name this series? Matches an alias exactly or as a prefix ("MOVE - A 30 Day…"). */
export function belongsTo(s: Session, def: SeriesDef): boolean {
  if (!s.series) return false
  const name = fold(s.series).trim()
  return def.match.some((alias) => {
    const a = fold(alias)
    return name === a || (name.startsWith(a) && !/[a-z0-9]/.test(name.charAt(a.length)))
  })
}

/** day → session, from your own links first, then sessions that carry the series and a day. */
export function linkedSessions(def: SeriesDef, sessions: Session[], progress?: SeriesProgress): Map<number, Session> {
  const out = new Map<number, Session>()
  for (const s of sessions) {
    if (!belongsTo(s, def)) continue
    const d = dayOf(s)
    if (d && d >= 1 && d <= def.length && !out.has(d)) out.set(d, s)
  }
  if (progress) {
    const byId = new Map(sessions.map((s) => [s.id, s]))
    for (const [day, id] of Object.entries(progress.links)) {
      const s = byId.get(id)
      if (s) out.set(Number(day), s)
    }
  }
  return out
}

/**
 * Whether a practice on `date` belongs to this run. Anything since the run
 * started does; so does anything earlier that came after the previous run ended
 * (all of it, on a first run). Days you practised before pressing Start, or
 * logged afterwards with their real dates, count.
 */
export function inRun(progress: SeriesProgress, date: string): boolean {
  if (date >= progress.startedAt) return true
  const lastEnd = progress.runs.reduce((m, r) => (r.endedAt > m ? r.endedAt : m), '')
  return date > lastEnd
}

/** When this run really began: its start, or an earlier practice it counts. */
export function runStart(progress: SeriesProgress, done: Map<number, string>): string {
  let start = progress.startedAt
  for (const date of done.values()) if (date < start) start = date
  return start
}

/**
 * Which days are done in the current (or last) run, with the date each was done.
 * With `sessions`, a practice of any copy of a day counts (the channel sometimes
 * has two uploads of the same day), not only the one linked.
 */
export function doneDays(
  def: SeriesDef, progress: SeriesProgress | undefined, linked: Map<number, Session>, history: PracticeEntry[], sessions?: Session[],
): Map<number, string> {
  const out = new Map<number, string>()
  if (!progress || progress.status === 'idle') return out
  for (const [day, date] of Object.entries(progress.manualDays)) {
    const d = Number(day)
    if (d >= 1 && d <= def.length) out.set(d, date)
  }
  const until = progress.status === 'active' ? '9999-12-31' : progress.endedAt ?? '9999-12-31'
  const dayBySession = new Map([...linked].map(([d, s]) => [s.id, d]))
  for (const s of sessions ?? []) {
    const d = dayOf(s)
    if (d && d <= def.length && !dayBySession.has(s.id) && belongsTo(s, def)) dayBySession.set(s.id, d)
  }
  // History is newest first; walk it oldest first so each day keeps its first date.
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    const d = dayBySession.get(h.sessionId)
    if (d && !out.has(d) && inRun(progress, h.date) && h.date <= until) out.set(d, h.date)
  }
  return out
}

/** Days skipped in this run and not practised since: day → date skipped. */
export function skippedDays(def: SeriesDef, progress: SeriesProgress | undefined, done: Map<number, string>): Map<number, string> {
  const out = new Map<number, string>()
  if (!progress || progress.status === 'idle') return out
  for (const [day, date] of Object.entries(progress.skippedDays ?? {})) {
    const d = Number(day)
    if (d >= 1 && d <= def.length && !done.has(d)) out.set(d, date)
  }
  return out
}

/** The first day neither done nor skipped. */
export function nextDay(def: SeriesDef, done: Map<number, string>, skipped?: Map<number, string>): number | null {
  for (let d = 1; d <= def.length; d++) if (!done.has(d) && !skipped?.has(d)) return d
  return null
}

export function skipDay(p: SeriesProgress, day: number, date: string, skip: boolean): SeriesProgress {
  const skippedDays = { ...(p.skippedDays ?? {}) }
  if (skip) skippedDays[day] = date
  else delete skippedDays[day]
  return { ...p, skippedDays }
}

export interface Pace {
  /** Days (or weeks) the calendar says you'd have reached by now, at one per day/week. */
  expected: number
  done: number
  /** done − expected, so negative means behind. */
  delta: number
  /** For the series itself: the honest calendar count, worded neutrally. */
  label: string
  /**
   * For the Today page, which never counts misses: it celebrates a practice done
   * today and otherwise simply invites the next one. At one practice a day there
   * is no catching up, so a deficit there would only nag.
   */
  today: string
}

/** A gentle reading of the run so far. Never a score. */
export function pace(def: SeriesDef, progress: SeriesProgress, doneCount: number, today: string, practisedToday = false): Pace {
  const elapsed = Math.max(0, daysBetween(progress.startedAt, today))
  const step = def.unit === 'Week' ? 7 : 1
  // Where the calendar is today (Day 1 on the day you start)…
  const expected = Math.min(def.length, Math.floor(elapsed / step) + 1)
  // …but today's practice can still happen today, so you're only behind on days already gone.
  const delta = Math.min(0, doneCount - (expected - 1))
  const unit = def.unit.toLowerCase()
  const allDone = doneCount >= def.length
  const label = allDone ? 'Every practice done'
    : delta >= 0 ? 'On your rhythm'
    : `${-delta} ${-delta === 1 ? unit : `${unit}s`} off the calendar`
  const todayLabel = allDone ? 'Every practice done'
    : practisedToday ? (def.unit === 'Week' ? 'Practised this week' : 'Practised today')
    : delta >= 0 ? 'On your rhythm'
    : 'Ready when you are'
  return { expected, done: doneCount, delta, label, today: todayLabel }
}

/**
 * Whether this series was practised today (in the current series week, for a
 * weekly one): a practice of one of its sessions logged then, or a day ticked then.
 */
export function practisedToday(def: SeriesDef, progress: SeriesProgress, linked: Map<number, Session>, history: PracticeEntry[], today: string): boolean {
  let since = today
  if (def.unit === 'Week') {
    const back = Math.max(0, daysBetween(progress.startedAt, today)) % 7
    const d = new Date(`${today}T12:00:00`)
    d.setDate(d.getDate() - back)
    since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const ids = new Set([...linked.values()].map((x) => x.id))
  if (history.some((h) => h.date >= since && h.date <= today && ids.has(h.sessionId))) return true
  return Object.values(progress.manualDays).some((d) => d >= since && d <= today)
}

const NOISE = new Set(['yoga with adriene', 'a 30 day yoga journey', '30 days of yoga', 'a january series with adriene'])

/** The day's own name from its video title: "Flow - Day 2 - Notice" → "Notice". '' when the title has none. */
export function dayTheme(title: string, def: SeriesDef): string {
  const aliases = new Set(def.match.map(fold))
  return title
    .split(/\s*\|\s*|\s+-\s*|\s*-\s+/)
    .map((p) => p.trim())
    .filter((p) => {
      const f = fold(p)
      if (!f || NOISE.has(f) || aliases.has(f)) return false
      if (/^(?:day|week)\s*\d+\b/.test(f) || /^\d+$/.test(f)) return false
      if ([...aliases].some((a) => f.startsWith(`${a} day`) || f.startsWith(`${a} week`))) return false
      return true
    })
    .join(' – ')
}

export function daySearchUrl(def: SeriesDef, day: number): string {
  return searchUrl(`${def.instructor} ${def.name} ${def.unit} ${day}`)
}

export function startProgress(def: SeriesDef, today: string, previous?: SeriesProgress, doneCountBefore = 0): SeriesProgress {
  const runs = previous ? [...previous.runs] : []
  // A run still active when restarted is recorded as abandoned, so nothing is lost.
  if (previous?.status === 'active') runs.push({ startedAt: previous.startedAt, endedAt: today, status: 'abandoned', daysDone: doneCountBefore, ...skipsOf(previous) })
  return { seriesId: def.id, status: 'active', startedAt: today, manualDays: {}, skippedDays: {}, links: previous?.links ?? {}, runs }
}

export function finishProgress(p: SeriesProgress, status: 'completed' | 'abandoned', today: string, daysDone: number): SeriesProgress {
  return { ...p, status, endedAt: today, runs: [...p.runs, { startedAt: p.startedAt, endedAt: today, status, daysDone, ...skipsOf(p) }] }
}

/** A run's skips, carried into its record so they stay on the calendar. */
const skipsOf = (p: SeriesProgress) => (p.skippedDays && Object.keys(p.skippedDays).length ? { skippedDays: { ...p.skippedDays } } : {})

/**
 * Every day skipped across your series, current and earlier runs, with the date
 * it was skipped: for My Practice's calendar.
 */
export function allSkips(defs: SeriesDef[], progress: Record<string, SeriesProgress>): { date: string; def: SeriesDef; day: number }[] {
  const out: { date: string; def: SeriesDef; day: number }[] = []
  for (const def of defs) {
    const p = progress[def.id]
    if (!p) continue
    const seen = new Set<string>()
    const add = (rec?: Record<string, string>) => {
      for (const [day, date] of Object.entries(rec ?? {})) {
        const key = `${day}@${date}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ date, def, day: Number(day) })
      }
    }
    for (const r of p.runs) add(r.skippedDays)
    if (p.status !== 'idle') add(p.skippedDays)
  }
  return out
}

export function toggleDay(p: SeriesProgress, day: number, date: string, done: boolean): SeriesProgress {
  const manualDays = { ...p.manualDays }
  if (done) manualDays[day] = date
  else delete manualDays[day]
  return { ...p, manualDays }
}

/** Series this session is part of, and its day in each. */
export function seriesOfSession(s: Session, defs: SeriesDef[], progress: Record<string, SeriesProgress>): { def: SeriesDef; day: number }[] {
  const out: { def: SeriesDef; day: number }[] = []
  for (const def of defs) {
    const linkedDay = Object.entries(progress[def.id]?.links ?? {}).find(([, id]) => id === s.id)?.[0]
    if (linkedDay) { out.push({ def, day: Number(linkedDay) }); continue }
    const d = dayOf(s)
    if (d && d <= def.length && belongsTo(s, def)) out.push({ def, day: d })
  }
  return out
}

export function customSeries(name: string, length: number, unit: 'Day' | 'Week', instructor: string): SeriesDef {
  const slug = fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'series'
  return {
    id: `custom-${slug}-${Date.now().toString(36)}`,
    name: name.trim(),
    length: Math.max(1, Math.min(90, Math.round(length))),
    unit,
    kind: 'custom',
    match: [fold(name.trim())],
    instructor,
  }
}
