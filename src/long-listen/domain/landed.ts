import { listeningState } from './listening'
import type { Feedback, ListeningEvent, Programme, ProgrammeItem } from './types'

/**
 * "How did it land?" — the one work to ask about, if any. Spotify marks works
 * heard silently, so the works played from Spotify — most of them — would
 * never get a reaction. The latest such work is asked about once, quietly: not
 * if anything has been said about it since, and not if it was asked before
 * (dismissing counts as an answer). Only works in a programme, so the
 * question can name what it was.
 *
 * Where Spotify lacked the curator's recording, a stand-in plays instead, and
 * it is the stand-in Spotify reports heard. Its id is on no programme item,
 * but its work is that item's work, so a heard recording is found by its own
 * id first and then by its work. `recordingId` is the one that played: the
 * question is marked asked under it, and a reaction filed under it.
 */
export function nextToAsk(
  events: ListeningEvent[],
  feedback: Feedback[],
  asked: Set<string>,
  programmes: Programme[],
): { item: ProgrammeItem; programme: Programme; heardAt: string; recordingId: string } | null {
  const where = new Map<string, { item: ProgrammeItem; programme: Programme }>()
  const byWork = new Map<string, { item: ProgrammeItem; programme: Programme }>()
  for (const p of programmes) {
    for (const item of p.sections.flatMap((s) => s.items)) {
      if (!where.has(item.recordingId)) where.set(item.recordingId, { item, programme: p })
      if (!byWork.has(item.workId)) byWork.set(item.workId, { item, programme: p })
    }
  }
  const heard = events
    .filter((e) => e.kind === 'heard' && e.source === 'spotify-recent')
    .sort((a, b) => (b.playedUntil ?? b.at).localeCompare(a.playedUntil ?? a.at))
  for (const e of heard) {
    if (asked.has(e.recordingId)) continue
    const at = where.get(e.recordingId) ?? byWork.get(e.workId)
    if (!at) continue
    // The listener's later word wins: a work since marked skipped (or reset) isn't asked about.
    if (listeningState(events, e.recordingId) !== 'heard') continue
    const said = feedback.some((f) => (f.target.id === e.recordingId || f.target.id === e.workId) && (f.reaction || f.note || f.more))
    if (said) continue
    return { ...at, heardAt: e.playedUntil ?? e.at, recordingId: e.recordingId }
  }
  return null
}

/** The mark that says a work was asked about (and so is never asked again). */
export const askedMark = (recordingId: string) => `asked:${recordingId}`
