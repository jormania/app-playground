import { listeningState } from './listening'
import { heardAs } from './standIns'
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
  /**
   * `standInsOf(comparisons)` (domain/standIns.ts): each stand-in's recording
   * maps to the very item it stood in for, and the item's state and what was
   * said are read over both recordings. Without it, a stand-in is found by its
   * work alone (the first item of that work), as before.
   */
  standIns: Map<string, string> = new Map(),
): { item: ProgrammeItem; programme: Programme; heardAt: string; recordingId: string } | null {
  const where = new Map<string, { item: ProgrammeItem; programme: Programme }>()
  const byWork = new Map<string, { item: ProgrammeItem; programme: Programme }>()
  for (const p of programmes) {
    for (const item of p.sections.flatMap((s) => s.items)) {
      // The item's own recording and its stand-in both lead back to it.
      for (const id of heardAs(item, p.id, standIns)) if (!where.has(id)) where.set(id, { item, programme: p })
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
    // Both recordings of the item, read as one — the curator's and the stand-in that played.
    const ids = [...new Set([e.recordingId, ...heardAs(at.item, at.programme.id, standIns)])]
    // The listener's later word wins: a work since marked skipped (or reset) isn't asked about.
    if (listeningState(events, ids) !== 'heard') continue
    const said = feedback.some((f) => (ids.includes(f.target.id) || f.target.id === e.workId) && (f.reaction || f.note || f.more))
    if (said) continue
    return { ...at, heardAt: e.playedUntil ?? e.at, recordingId: e.recordingId }
  }
  return null
}

/** The mark that says a work was asked about (and so is never asked again). */
export const askedMark = (recordingId: string) => `asked:${recordingId}`
