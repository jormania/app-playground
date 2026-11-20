import { BUILT_IN_SERIES } from '../data/series'
import type { PracticeEntry, SeriesDef, SeriesProgress, Session, Snapshotish } from './migrationTypes'
import { seriesFromTitle } from './channel'
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
    if (!s.tags.includes('from-channel')) continue
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

export function runMigrations(snap: Snapshotish, seriesReaderVersion: number | undefined, now = new Date()) {
  const sessionUpdates = (seriesReaderVersion ?? 0) < SERIES_READER_VERSION ? rereadChannelSeries(snap.sessions) : []
  const byId = new Map(snap.sessions.map((s) => [s.id, s]))
  for (const s of sessionUpdates) byId.set(s.id, s)
  const sessions = [...byId.values()]

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
