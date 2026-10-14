import type { Concert, Feedback, ISODate, Instant, ListeningEvent, Reaction } from './types'
import { when } from './listening'

/**
 * "Your earlier hearing" (release four): when a work comes back — another
 * recording, a second hearing, after a concert — the listening view says, in
 * one line, when it was last heard, in which recording or hall, and what was
 * said then. Memory, never a count: one hearing, the latest.
 *
 * What counts as earlier: a recording heard before this programme was made (a
 * hearing after that belongs to this programme, whichever recording it was —
 * Spotify's history carries no programme), or a concert on or before today.
 * What was said: a note (or, failing one, the reaction) given before this
 * programme was made, on that recording or on the work; at a concert, its note.
 */
export type EarlierHearing =
  | { kind: 'recording'; on: ISODate; recordingId: string; sameRecording: boolean; said?: Said }
  | { kind: 'concert'; on: ISODate; concert: Concert; said?: Said }

export type Said = { note: string } | { reaction: Reaction }

export function earlierHearing(args: {
  workId: string
  /** The recordings this listening view plays (the curator's and any stand-in). */
  recordingIds: string[]
  /** When this programme was made: a hearing since then is this programme's own (unless it names another). */
  since: Instant
  /** This programme: a hearing since it was made, in another programme, is still an earlier one. */
  programmeId?: string
  /** Today, in the listener's time zone. */
  today: ISODate
  /** An instant as a date in the listener's time zone. */
  dateOf: (at: Instant) => ISODate
  events: ListeningEvent[]
  feedback: Feedback[]
  concerts: Concert[]
}): EarlierHearing | undefined {
  const { workId, since, today, dateOf } = args
  // Before this programme was made — or, since, in another programme, which a hearing names when the app saw it.
  const elsewhere = (e: ListeningEvent) => Boolean(args.programmeId && e.programmeId && e.programmeId !== args.programmeId)
  const heard = args.events
    .filter((e) => e.kind === 'heard' && e.workId === workId && (when(e) < since || elsewhere(e)))
    .sort((a, b) => when(b).localeCompare(when(a)))[0]
  const live = args.concerts
    .filter((c) => c.date <= today && c.works.some((w) => w.workId === workId))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const heardOn = heard ? dateOf(when(heard)) : undefined
  // The later of the two; a concert wins a tie — the evening in the hall is the one remembered.
  if (live && (!heardOn || live.date >= heardOn)) {
    const fb = args.feedback.filter((f) => f.target.type === 'concert' && f.target.id === live.id && f.note)
    const note = live.note?.trim() || latest(fb)?.note
    return { kind: 'concert', on: live.date, concert: live, said: note ? { note } : undefined }
  }
  if (!heard || !heardOn) return undefined
  // What was said of that hearing: before this programme was made, or — for a hearing in another programme — in that one.
  const ofIt = (f: Feedback) => (f.at < since || (elsewhere(heard) && f.programmeId === heard.programmeId))
  const before = args.feedback.filter((f) => ofIt(f) && (f.target.id === heard.recordingId || (f.target.type === 'work' && f.target.id === workId)))
  const note = latest(before.filter((f) => f.note?.trim()))?.note?.trim()
  const reaction = latest(before.filter((f) => f.reaction))?.reaction
  return {
    kind: 'recording',
    on: heardOn,
    recordingId: heard.recordingId,
    sameRecording: args.recordingIds.includes(heard.recordingId),
    said: note ? { note } : reaction ? { reaction } : undefined,
  }
}

function latest(list: Feedback[]): Feedback | undefined {
  return [...list].sort((a, b) => b.at.localeCompare(a.at))[0]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "3 October", or "3 October 2025" outside this year. */
export function onDay(date: ISODate, today: ISODate): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}${date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`}`
}

/** A reaction as the end of a sentence about the listener: "… and loved it". */
const AS_SAID: Record<Reaction, string> = {
  loved: 'loved it',
  liked: 'liked it',
  interesting: 'found it interesting',
  'not-for-me': 'found it wasn’t for you',
  'too-difficult': 'found it too difficult',
}
export const reactionAsSaid = (r: Reaction) => AS_SAID[r]

/** A note, short enough for one line: cut at a word, with an ellipsis. */
export function shortNote(note: string, max = 140): string {
  const t = note.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.—–-]+$/, '')}…`
}
