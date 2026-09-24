import type { LogRecord } from '../log'
import { localDate } from '../progress/summary'

// Her progress, song by song, for the song list: the best stars from a
// finished run, and when she last played it (started, finished or stopped).
// Read from the engagement log, which already has both (KEYPATH_TUTOR.md §10).

export interface SongProgress {
  /** Best stars from a finished run; null if never finished. */
  bestStars: number | null
  /** When she last played it, as the log's ISO time. */
  lastPlayed: string
}

export function songProgress(records: readonly LogRecord[]): Map<string, SongProgress> {
  const out = new Map<string, SongProgress>()
  for (const r of records) {
    if (r.type !== 'song_started' && r.type !== 'song_finished' && r.type !== 'song_abandoned') continue
    const p = out.get(r.songId) ?? { bestStars: null, lastPlayed: r.at }
    if (r.type === 'song_finished') p.bestStars = Math.max(p.bestStars ?? 0, r.stars)
    if (r.at > p.lastPlayed) p.lastPlayed = r.at
    out.set(r.songId, p)
  }
  return out
}

export type PlayedWhen = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'on'; date: string }

/** "Today", "yesterday", or the day it was, on the phone's own calendar. */
export function playedWhen(iso: string, now: Date = new Date()): PlayedWhen {
  const day = localDate(iso)
  const today = localDate(now.toISOString())
  const yesterday = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).toISOString())
  if (day === today) return { kind: 'today' }
  if (day === yesterday) return { kind: 'yesterday' }
  return { kind: 'on', date: day }
}
