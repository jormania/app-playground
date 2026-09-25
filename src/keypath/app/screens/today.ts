import type { Song } from '../../engine'
import { JOURNEY, type StepId } from '../journey/steps'
import type { JourneyProgress } from '../journey/progress'
import type { LogRecord } from '../log'
import { localDate } from '../progress/summary'
import { tryNext } from '../songs/level'
import { K, type KeyValueStore } from '../store'

// Today (KEYPATH_TUTOR.md §10, "Learning curve", slice 3): three small things
// for about five minutes: a song (or its next part), a Journey step, a quick
// game, picked from her log. The picks are kept for the day, so they don't
// move as she plays; whether each is done is read from today's log. No
// streak: a missed day costs nothing, and tomorrow brings new picks.

export type TodayGame = 'race' | 'echo' | 'chord'
export type TodayItem = { kind: 'song'; songId: string } | { kind: 'journey'; step: StepId } | { kind: 'game'; game: TodayGame }

export interface TodayPlan {
  /** The phone's calendar day it was made for. */
  date: string
  items: TodayItem[]
}

const GAMES: TodayGame[] = ['race', 'echo', 'chord']
/** The note race read off a staff counts as the race. */
const gameOf = (g: string): TodayGame | null => (g === 'staff' ? 'race' : GAMES.includes(g as TodayGame) ? (g as TodayGame) : null)

/** Days since 1970 on the phone's calendar: a number that moves by one each day. */
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T12:00:00Z`) / 86400000)

export function planToday(records: readonly LogRecord[], journey: JourneyProgress, songs: readonly { song: Song }[], date: string): TodayPlan {
  const items: TodayItem[] = []

  // The song: the one she played last, until it has three stars; then the easiest one not finished yet.
  const best = new Map<string, number>()
  let last: string | null = null
  for (const r of records) {
    if (r.type === 'song_finished') best.set(r.songId, Math.max(best.get(r.songId) ?? 0, r.stars))
    if (r.type === 'song_started' || r.type === 'song_finished' || r.type === 'song_abandoned' || r.type === 'song_part') last = r.songId
  }
  const known = (id: string | null) => !!id && songs.some((e) => e.song.id === id)
  if (known(last) && (best.get(last!) ?? 0) < 3) items.push({ kind: 'song', songId: last! })
  else {
    const pick = tryNext(songs, (id) => best.has(id), known(last) ? last! : '')
    if (pick) items.push({ kind: 'song', songId: pick.song.id })
  }

  // The Journey: the first step not done. Once it's all done there's nothing to add.
  const open = JOURNEY.find((s) => !journey[s.id])
  if (open) items.push({ kind: 'journey', step: open.id })

  // A game: the one she has played least, taking turns day by day between equals.
  const played = new Map<TodayGame, number>(GAMES.map((g) => [g, 0]))
  for (const r of records) {
    if (r.type !== 'challenge_finished') continue
    const g = gameOf(r.game)
    if (g) played.set(g, played.get(g)! + 1)
  }
  const least = Math.min(...played.values())
  const tied = GAMES.filter((g) => played.get(g) === least)
  items.push({ kind: 'game', game: tied[dayNumber(date) % tied.length] })

  return { date, items }
}

/** Done today: the song finished or a part of it learnt, the step practised or checked, the game played to its end. */
export function isDone(item: TodayItem, records: readonly LogRecord[], date: string): boolean {
  return records.some((r) => {
    if (localDate(r.at) !== date) return false
    switch (item.kind) {
      case 'song':
        return (r.type === 'song_finished' && r.songId === item.songId) || (r.type === 'song_part' && r.songId === item.songId && r.passed)
      case 'journey':
        return r.type === 'journey_finished' && r.step === item.step && (r.mode === 'practice' || r.passed)
      case 'game':
        return r.type === 'challenge_finished' && gameOf(r.game) === item.game
    }
  })
}

/** Today's plan for this player: the one made earlier today, or a new one. */
export async function todayFor(store: KeyValueStore, profileId: string, make: () => TodayPlan, date: string): Promise<TodayPlan> {
  const kept = await store.get<TodayPlan>(K.today(profileId))
  if (kept?.date === date) return kept
  const plan = make()
  await store.set(K.today(profileId), plan)
  return plan
}
