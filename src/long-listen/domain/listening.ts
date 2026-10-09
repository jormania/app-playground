import type { Feedback, ListeningEvent, ListeningState, Reaction, WantMore } from './types'

/**
 * Where a recording stands for the listener: not started, listening, heard,
 * skipped. This is memory for the curator and for the listener's notebook —
 * it is never added up, charted, or shown as progress.
 *
 * Manual marks are the listener's word and always win when they are the most
 * recent. Spotify's recently-played history can only move a recording forward
 * (not started → listening → heard); it never undoes something the listener
 * said, and a partial play never downgrades "heard".
 */
const RANK: Record<ListeningState, number> = { 'not-started': 0, skipped: 0, listening: 1, heard: 2 }

function stateOfKind(e: ListeningEvent): ListeningState {
  switch (e.kind) {
    case 'heard': return 'heard'
    case 'skipped': return 'skipped'
    case 'reset': return 'not-started'
    default: return 'listening' // opened, play-started, listening, partial
  }
}

/**
 * When it happened: a Spotify play is placed at the time it was played, not
 * the later moment the app heard about it — so a reset made after a play is
 * not overturned by that play arriving on the next sync.
 */
function when(e: ListeningEvent): string {
  return e.source === 'spotify-recent' ? (e.playedUntil ?? e.playedAt ?? e.at) : e.at
}

export function listeningState(events: ListeningEvent[], recordingId: string | string[]): ListeningState {
  // Several ids are one work's recordings read as one — the curator's and the stand-in that played in its place.
  const ids = new Set(Array.isArray(recordingId) ? recordingId : [recordingId])
  const mine = events.filter((e) => ids.has(e.recordingId)).sort((a, b) => when(a).localeCompare(when(b)))
  let state: ListeningState = 'not-started'
  for (const e of mine) {
    const next = stateOfKind(e)
    if (e.source === 'manual') state = next
    else if (RANK[next] > RANK[state] || (state === 'skipped' && next === 'heard')) state = next
  }
  return state
}

/** How many separate times the listener has heard it — for "you've come back to this", never a count on screen. */
export function timesHeard(events: ListeningEvent[], recordingId: string): number {
  return events.filter((e) => e.recordingId === recordingId && e.kind === 'heard').length
}

export const REACTIONS: { value: Reaction; label: string }[] = [
  { value: 'loved', label: 'Loved it' },
  { value: 'liked', label: 'Liked it' },
  { value: 'interesting', label: 'Interesting' },
  { value: 'not-for-me', label: 'Not for me' },
  { value: 'too-difficult', label: 'Too difficult' },
]

export const WANT_MORE: { value: WantMore; label: string }[] = [
  { value: 'yes', label: 'More like this' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Less like this' },
]

export function reactionLabel(r?: Reaction): string | undefined {
  return REACTIONS.find((x) => x.value === r)?.label
}

/** The latest feedback on a target, merged: a later reaction replaces an earlier one; notes accumulate. */
export function latestFeedback(all: Feedback[], targetId: string): { reaction?: Reaction; more?: WantMore; notes: string[]; known?: boolean } {
  const mine = all.filter((f) => f.target.id === targetId).sort((a, b) => a.at.localeCompare(b.at))
  const out: { reaction?: Reaction; more?: WantMore; notes: string[]; known?: boolean } = { notes: [] }
  for (const f of mine) {
    if (f.reaction) out.reaction = f.reaction
    if (f.more) out.more = f.more
    if (f.note) out.notes.push(f.note)
    if (f.known !== undefined) out.known = f.known
  }
  return out
}

/** Works the listener said they knew before the app suggested them (latest word wins). */
export function knownWorkIds(all: Feedback[]): Set<string> {
  const ids = new Set(all.filter((f) => f.target.type === 'work' && f.known !== undefined).map((f) => f.target.id))
  return new Set([...ids].filter((id) => latestFeedback(all, id).known))
}
