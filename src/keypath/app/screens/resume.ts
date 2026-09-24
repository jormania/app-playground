import { JOURNEY } from '../journey/steps'
import type { LogRecord } from '../log'

/** Where she was last: a song (with her best stars on it), or a Journey step. */
export type Resume = { kind: 'song'; songId: string; bestStars: number | null } | { kind: 'journey'; step: string }

/**
 * The last song or Journey step in her log, for Home's "pick up where you
 * left off". A Journey step she has just passed points on to the next one.
 */
export function resumeFrom(records: readonly LogRecord[]): Resume | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (r.type === 'song_started' || r.type === 'song_finished' || r.type === 'song_abandoned') {
      const stars = records.filter((x) => x.type === 'song_finished' && x.songId === r.songId).map((x) => (x.type === 'song_finished' ? x.stars : 0))
      return { kind: 'song', songId: r.songId, bestStars: stars.length ? Math.max(...stars) : null }
    }
    if (r.type === 'journey_started' || r.type === 'journey_left') return { kind: 'journey', step: r.step }
    if (r.type === 'journey_finished') {
      if (r.mode === 'check' && r.passed) {
        const next = JOURNEY[JOURNEY.findIndex((s) => s.id === r.step) + 1]
        return next ? { kind: 'journey', step: next.id } : null
      }
      return { kind: 'journey', step: r.step }
    }
  }
  return null
}
