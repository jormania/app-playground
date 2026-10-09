import type { Feedback, ListeningEvent, Programme, ProgrammeItem } from './types'

/**
 * "How did it land?" — the one work to ask about, if any. Spotify marks works
 * heard silently, so the works played from Spotify — most of them — would
 * never get a reaction. The latest such work is asked about once, quietly: not
 * if anything has been said about it since, and not if it was asked before
 * (dismissing counts as an answer). Only works in a programme, so the
 * question can name what it was.
 */
export function nextToAsk(
  events: ListeningEvent[],
  feedback: Feedback[],
  asked: Set<string>,
  programmes: Programme[],
): { item: ProgrammeItem; programme: Programme; heardAt: string } | null {
  const where = new Map<string, { item: ProgrammeItem; programme: Programme }>()
  for (const p of programmes) for (const item of p.sections.flatMap((s) => s.items)) if (!where.has(item.recordingId)) where.set(item.recordingId, { item, programme: p })
  const heard = events
    .filter((e) => e.kind === 'heard' && e.source === 'spotify-recent')
    .sort((a, b) => (b.playedUntil ?? b.at).localeCompare(a.playedUntil ?? a.at))
  for (const e of heard) {
    if (asked.has(e.recordingId)) continue
    const at = where.get(e.recordingId)
    if (!at) continue
    const said = feedback.some((f) => (f.target.id === e.recordingId || f.target.id === e.workId) && (f.reaction || f.note || f.more))
    if (said) continue
    return { ...at, heardAt: e.playedUntil ?? e.at }
  }
  return null
}

/** The mark that says a work was asked about (and so is never asked again). */
export const askedMark = (recordingId: string) => `asked:${recordingId}`
