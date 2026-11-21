import { BUILT_IN_SERIES } from '../data/series'
import type { PracticeEntry, SeriesDef, SeriesProgress, Session, Snapshotish } from './migrationTypes'
import { readDescription, seriesFromTitle } from './channel'
import { linkedSessions } from './series'

/**
 * One-off repairs run when the app loads. Pure: a snapshot in, the records to
 * write out. Each is idempotent, so running it twice changes nothing.
 */

/** Version of the title reader; bump when seriesFromTitle learns something new. */
export const SERIES_READER_VERSION = 2

/**
 * Channel imports from before Release 3 read series from titles with a matcher
 * that missed most formats ("Flow - Day 21") and misfiled others ("TRUE - Day
 * 12 - CENTER" under CENTER). Re-read every session that came from the
 * channel, using the title YouTube gave it.
 */
export function rereadChannelSeries(sessions: Session[]): Session[] {
  const changed: Session[] = []
  for (const s of sessions) {
    if (!s.tags.includes('from-channel') || s.tags.includes('series-by-hand')) continue
    const r = seriesFromTitle(s.title)
    const series = r?.series
    const seriesDay = r?.day
    if (s.series === series && s.seriesDay === seriesDay) continue
    const next: Session = { ...s, series, seriesDay }
    if (!series) { delete next.series; delete next.seriesDay }
    changed.push(next)
  }
  return changed
}

/**
 * Until Release 3, ticking a series day only marked the day; it never reached
 * My Practice. A ticked day that has a session in the library becomes a
 * practice entry on the date it was ticked, and the tick is dropped (the day
 * stays done, now through history). Days with no session keep their tick.
 */
export function ticksToPractice(
  def: SeriesDef, progress: SeriesProgress, sessions: Session[], history: PracticeEntry[], now = new Date(),
): { progress: SeriesProgress; entries: PracticeEntry[] } | null {
  if (progress.status === 'idle') return null
  const linked = linkedSessions(def, sessions, progress)
  const entries: PracticeEntry[] = []
  const manualDays = { ...progress.manualDays }
  for (const [dayKey, date] of Object.entries(progress.manualDays)) {
    const s = linked.get(Number(dayKey))
    if (!s) continue
    delete manualDays[dayKey]
    // Already in history for that date (logged twice by hand): just drop the tick.
    if (history.some((h) => h.sessionId === s.id && h.date === date)) continue
    entries.push({
      id: `p-tick-${def.id}-${dayKey}-${date}`,
      sessionId: s.id,
      date,
      minutes: s.durationMinutes,
      createdAt: now.toISOString(),
    })
  }
  if (Object.keys(manualDays).length === Object.keys(progress.manualDays).length) return null
  return { progress: { ...progress, manualDays }, entries }
}

/**
 * Demo records were seeded on first launch until Release 6. Once a real library
 * is in place (ten or more of your own sessions) they're only clutter: removed,
 * unless you practised, rated, linked or otherwise touched one.
 */
export function demosToRemove(
  snap: Snapshotish & { userData?: Record<string, unknown>; collections?: { sessionIds: string[] }[] },
): string[] {
  const real = snap.sessions.filter((s) => !s.isDemo).length
  if (real < 10) return []
  const used = new Set<string>([
    ...snap.history.map((h) => h.sessionId),
    ...Object.keys(snap.userData ?? {}),
    ...(snap.collections ?? []).flatMap((c) => c.sessionIds),
    ...Object.values(snap.seriesProgress).flatMap((p) => Object.values(p.links ?? {})),
  ])
  return snap.sessions.filter((s) => s.isDemo && !used.has(s.id)).map((s) => s.id)
}

/**
 * Until Release 8 only titles were read, so most of the library carried no
 * style, body area or goal. Fill those in from the opening of each video's
 * description, for sessions that are still a guess. Only adds: anything you
 * set, or that a practice taught it, stays; intensity is set only where none is.
 */
export function readDescriptions(sessions: Session[]): Session[] {
  const changed: Session[] = []
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]
  for (const s of sessions) {
    if (s.classificationSource !== 'inferred' || !s.description) continue
    const d = readDescription(s.description)
    const next: Session = {
      ...s,
      styles: union(s.styles, d.styles),
      physicalFocus: union(s.physicalFocus, d.physicalFocus),
      objectives: union(s.objectives, d.objectives),
      intensity: s.intensity || d.intensity,
    }
    if (next.styles.length !== s.styles.length || next.physicalFocus.length !== s.physicalFocus.length ||
      next.objectives.length !== s.objectives.length || next.intensity !== s.intensity) changed.push(next)
  }
  return changed
}

export function runMigrations(snap: Snapshotish, seriesReaderVersion: number | undefined, now = new Date()) {
  // Cheap and idempotent, so it runs on every load: sessions imported since the
  // last load (a file, a backup) get their series too. The version is kept for
  // the record; it no longer gates the re-read.
  void seriesReaderVersion
  const byId = new Map(snap.sessions.map((s) => [s.id, s]))
  const touched = new Set<string>()
  for (const s of rereadChannelSeries(snap.sessions)) { byId.set(s.id, s); touched.add(s.id) }
  for (const s of readDescriptions([...byId.values()])) { byId.set(s.id, s); touched.add(s.id) }
  const sessions = [...byId.values()]
  const sessionUpdates = [...touched].map((id) => byId.get(id)!)

  const defs = [...BUILT_IN_SERIES, ...snap.customSeries]
  const progressUpdates: SeriesProgress[] = []
  const newEntries: PracticeEntry[] = []
  for (const def of defs) {
    const p = snap.seriesProgress[def.id]
    if (!p) continue
    const r = ticksToPractice(def, p, sessions, [...snap.history, ...newEntries], now)
    if (!r) continue
    progressUpdates.push(r.progress)
    newEntries.push(...r.entries)
  }
  return { sessionUpdates, progressUpdates, newEntries }
}
