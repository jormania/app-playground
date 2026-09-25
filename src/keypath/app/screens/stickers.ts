import type { StringKey } from '../i18n'
import { JOURNEY } from '../journey/steps'
import type { LogRecord } from '../log'
import { localDate } from '../progress/summary'
import { K, type KeyValueStore } from '../store'

// Stickers for firsts and milestones (KEYPATH_TUTOR.md §10, "Learning curve",
// slice 3; twenty since the second batch). Read
// from the engagement log, which only ever grows, so a sticker once earned is
// never taken away. Each is shown as new once, then kept on her Home.

/** What the log has shown so far, for stickers that depend on more than one record. */
export interface So {
  /** How each song was last started: 'wait' or 'running' (with a clock). */
  startedAs: Map<string, string>
  /** Songs finished at least once. */
  finished: Set<string>
  /** Songs with a part learnt (short of the whole song). */
  partLearnt: Set<string>
  /** Journey steps whose check was passed. */
  stepsPassed: Set<string>
  /** Days she practised on. */
  days: Set<string>
  /** A song's level, when the phone knows the song. */
  level: (songId: string) => number | undefined
}

export interface Sticker {
  id: string
  icon: string
  title: StringKey
  /** The record that earns it, given everything before it (and it). */
  earns: (r: LogRecord, so: So) => boolean
}

/** Days she played on, for the practice-day stickers: any day with a song, a step, a game or a take. */
const PRACTICE = new Set(['song_started', 'journey_started', 'challenge_started', 'studio_recorded'])
export const WEEK_DAYS = 7
export const MONTH_DAYS = 30
/** Rhythm echo's round. */
const ECHO_ROUND = 5

// Roughly in the order she'll meet them: first steps, then songs, then the longer haul.
export const STICKERS: Sticker[] = [
  { id: 'firstSong', icon: '🎵', title: 'stFirstSong', earns: (r) => r.type === 'song_finished' },
  { id: 'fingers', icon: '✋', title: 'stFingers', earns: (r) => r.type === 'journey_finished' && r.step === 'fingers' && r.mode === 'check' && r.passed },
  { id: 'cleanStep', icon: '🗺️', title: 'stCleanStep', earns: (r) => r.type === 'journey_finished' && r.mode === 'check' && r.passed && r.wrong === 0 },
  { id: 'reading', icon: '🎼', title: 'stReading', earns: (r) => r.type === 'journey_finished' && r.step === 'notation' && r.mode === 'check' && r.passed },
  { id: 'threeStars', icon: '⭐', title: 'stThreeStars', earns: (r) => r.type === 'song_finished' && r.stars === 3 },
  { id: 'part', icon: '🧩', title: 'stPart', earns: (r) => r.type === 'song_part' && r.passed && r.part !== 'whole' },
  { id: 'wholeInParts', icon: '🏅', title: 'stWholeInParts', earns: (r, so) => r.type === 'song_part' && r.part === 'whole' && r.passed && so.partLearnt.has(r.songId) },
  { id: 'cleanBar', icon: '🔁', title: 'stCleanBar', earns: (r) => r.type === 'song_loop' && r.done },
  { id: 'bothHands', icon: '🙌', title: 'stBothHands', earns: (r) => r.type === 'song_finished' && r.practice === 'both' },
  { id: 'inTime', icon: '⏱️', title: 'stInTime', earns: (r, so) => r.type === 'song_finished' && so.startedAs.get(r.songId) === 'running' },
  { id: 'fiveSongs', icon: '🎶', title: 'stFiveSongs', earns: (r, so) => r.type === 'song_finished' && so.finished.size >= 5 },
  { id: 'harder', icon: '🏔️', title: 'stHarder', earns: (r, so) => r.type === 'song_finished' && so.level(r.songId) === 3 },
  { id: 'journeyDone', icon: '🏁', title: 'stJourneyDone', earns: (r, so) => r.type === 'journey_finished' && JOURNEY.every((s) => so.stepsPassed.has(s.id)) },
  { id: 'newBest', icon: '⚡', title: 'stNewBest', earns: (r) => r.type === 'challenge_finished' && r.best },
  { id: 'echoAll', icon: '🥁', title: 'stEchoAll', earns: (r) => r.type === 'challenge_finished' && r.game === 'echo' && r.score >= ECHO_ROUND },
  { id: 'recording', icon: '🎨', title: 'stRecording', earns: (r) => r.type === 'studio_kept' },
  { id: 'ownSong', icon: '📥', title: 'stOwnSong', earns: (r) => r.type === 'song_added' },
  { id: 'today', icon: '☀️', title: 'stToday', earns: (r) => r.type === 'today_done' },
  { id: 'week', icon: '📅', title: 'stWeek', earns: (r, so) => PRACTICE.has(r.type) && so.days.size >= WEEK_DAYS },
  { id: 'month', icon: '🗓️', title: 'stMonth', earns: (r, so) => PRACTICE.has(r.type) && so.days.size >= MONTH_DAYS },
]

/** Each sticker earned, with the day it was earned on. `level` tells a song's level, for "a Harder song". */
export function earnedStickers(records: readonly LogRecord[], level: So['level'] = () => undefined): Map<string, string> {
  const out = new Map<string, string>()
  const so: So = { startedAs: new Map(), finished: new Set(), partLearnt: new Set(), stepsPassed: new Set(), days: new Set(), level }
  for (const r of records) {
    // What this record adds comes first, so the fifth song finished counts on the fifth.
    if (r.type === 'song_started') so.startedAs.set(r.songId, r.mode)
    if (r.type === 'song_finished') so.finished.add(r.songId)
    if (r.type === 'song_part' && r.passed && r.part !== 'whole') so.partLearnt.add(r.songId)
    if (r.type === 'journey_finished' && r.mode === 'check' && r.passed) so.stepsPassed.add(r.step)
    if (PRACTICE.has(r.type)) so.days.add(localDate(r.at))
    for (const s of STICKERS) if (!out.has(s.id) && s.earns(r, so)) out.set(s.id, localDate(r.at))
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
