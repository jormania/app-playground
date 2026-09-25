import type { StringKey } from '../i18n'
import type { LogRecord } from '../log'
import { localDate } from '../progress/summary'
import { K, type KeyValueStore } from '../store'

// Stickers for firsts (KEYPATH_TUTOR.md §10, "Learning curve", slice 3). Read
// from the engagement log, which only ever grows, so a sticker once earned is
// never taken away. Each is shown as new once, then kept on her Home.

export interface Sticker {
  id: string
  icon: string
  title: StringKey
  /** The record that earns it. */
  earns?: (r: LogRecord) => boolean
}

/** Days she played on, for "a week of practice days": any day with a song, a step, a game or a take. */
const PRACTICE = new Set(['song_started', 'journey_started', 'challenge_started', 'studio_recorded'])
export const WEEK_DAYS = 7

export const STICKERS: Sticker[] = [
  { id: 'firstSong', icon: '🎵', title: 'stFirstSong', earns: (r) => r.type === 'song_finished' },
  { id: 'threeStars', icon: '⭐', title: 'stThreeStars', earns: (r) => r.type === 'song_finished' && r.stars === 3 },
  { id: 'fingers', icon: '✋', title: 'stFingers', earns: (r) => r.type === 'journey_finished' && r.step === 'fingers' && r.mode === 'check' && r.passed },
  { id: 'cleanStep', icon: '🗺️', title: 'stCleanStep', earns: (r) => r.type === 'journey_finished' && r.mode === 'check' && r.passed && r.wrong === 0 },
  { id: 'part', icon: '🧩', title: 'stPart', earns: (r) => r.type === 'song_part' && r.passed && r.part !== 'whole' },
  { id: 'cleanBar', icon: '🔁', title: 'stCleanBar', earns: (r) => r.type === 'song_loop' && r.done },
  { id: 'newBest', icon: '⚡', title: 'stNewBest', earns: (r) => r.type === 'challenge_finished' && r.best },
  { id: 'recording', icon: '🎨', title: 'stRecording', earns: (r) => r.type === 'studio_kept' },
  { id: 'week', icon: '📅', title: 'stWeek' },
]

/** Each sticker earned, with the day it was earned on. */
export function earnedStickers(records: readonly LogRecord[]): Map<string, string> {
  const out = new Map<string, string>()
  const days = new Set<string>()
  for (const r of records) {
    for (const s of STICKERS) if (!out.has(s.id) && s.earns?.(r)) out.set(s.id, localDate(r.at))
    if (PRACTICE.has(r.type)) {
      days.add(localDate(r.at))
      if (days.size === WEEK_DAYS && !out.has('week')) out.set('week', localDate(r.at))
    }
  }
  return out
}

/** Stickers already shown to her; the rest of those earned are new. */
export async function seenStickers(store: KeyValueStore, profileId: string): Promise<Set<string>> {
  return new Set((await store.get<string[]>(K.stickers(profileId))) ?? [])
}

export async function markSeen(store: KeyValueStore, profileId: string, ids: Iterable<string>): Promise<void> {
  await store.set(K.stickers(profileId), [...new Set([...(await seenStickers(store, profileId)), ...ids])])
}
