import type { Comparison, Feedback, ListeningEvent, ProgrammeItem, ProposedRecording } from './types'
import { latestFeedback } from './listening'

/**
 * A stand-in is the item. Where Spotify lacked the curator's recording, a
 * stand-in played in its place (a comparison `cmp:<programmeId>:<itemId>`
 * marked `standIn`), and the listening and the reactions were filed under the
 * stand-in — what was actually heard. Every reader of "how did this item land"
 * asks about both, or a work heard and loved through a stand-in reads as never
 * started.
 *
 * These live in `domain/` (not `curation/continuity.ts`, which re-exports
 * them) so that the domain's own readers — a thread's contents, "how did it
 * land?" — can use the very same helpers rather than a hand-rolled copy.
 */

/** Comparison id → the stand-in's recording id, for every stand-in stored. */
export function standInsOf(comparisons: Comparison[]): Map<string, string> {
  return new Map(comparisons.filter((c) => c.standIn && c.perspectives.length > 1).map((c) => [c.id, c.perspectives[1].recordingId]))
}

/** The recordings an item was heard through: the curator's, and its stand-in if it has one. */
export function heardAs(item: Pick<ProgrammeItem, 'id' | 'recordingId'>, programmeId: string, standIns: Map<string, string>): string[] {
  const standIn = standIns.get(`cmp:${programmeId}:${item.id}`)
  return standIn && standIn !== item.recordingId ? [item.recordingId, standIn] : [item.recordingId]
}

/** `latestFeedback` over several targets read as one — the curator's recording and its stand-in. */
export function feedbackOnAny(all: Feedback[], ids: string[]): ReturnType<typeof latestFeedback> {
  if (ids.length === 1) return latestFeedback(all, ids[0])
  const wanted = new Set(ids)
  return latestFeedback(all.filter((f) => wanted.has(f.target.id)).map((f) => ({ ...f, target: { ...f.target, id: ids[0] } })), ids[0])
}

/**
 * What was said about an item, the recording heard and the work read together:
 * the reaction on the recording first, the work's if the recording has none, and
 * every note on either. One merge for every reader — the season once let the
 * work's word replace the recording's.
 */
export function itemFeedback(all: Feedback[], ids: string[], workId: string): { reaction?: Feedback['reaction']; more?: Feedback['more']; notes: string[] } {
  const rec = feedbackOnAny(all, ids)
  const work = latestFeedback(all, workId)
  return { reaction: rec.reaction ?? work.reaction, more: rec.more ?? work.more, notes: [...rec.notes, ...work.notes] }
}

/** Comparison id → who played in the stand-in: its recording and its performers. */
export function standInPlayersOf(comparisons: Comparison[]): Map<string, { recordingId: string; proposed: ProposedRecording }> {
  return new Map(comparisons.filter((c) => c.standIn && c.perspectives.length > 1).map((c) => [c.id, { recordingId: c.perspectives[1].recordingId, proposed: c.perspectives[1].proposed }]))
}

/**
 * The recording an item was heard in, as named for the curator or a reader:
 * the item itself (the curator's composer and title, so work identity holds),
 * credited to the stand-in's performers when that is what the listener played
 * or spoke about — otherwise to the curator's. A digest that said "heard,
 * loved" beside the curator's Boulez, when it was Rattle who played, told the
 * curator the wrong recording landed.
 */
export function playedProposed(
  item: Pick<ProgrammeItem, 'id' | 'recordingId' | 'proposed'>,
  programmeId: string,
  players: Map<string, { recordingId: string; proposed: ProposedRecording }>,
  events: ListeningEvent[],
  feedback: Feedback[] = [],
): ProposedRecording {
  const s = players.get(`cmp:${programmeId}:${item.id}`)
  if (!s || s.recordingId === item.recordingId) return item.proposed
  const played = events.some((e) => e.recordingId === s.recordingId) || feedback.some((f) => f.target.id === s.recordingId)
  if (!played) return item.proposed
  const { conductor, orchestra, ensemble, soloists, year } = s.proposed
  return { composer: item.proposed.composer, work: item.proposed.work, catalogue: item.proposed.catalogue, conductor, orchestra, ensemble, soloists: soloists ?? [], year }
}
