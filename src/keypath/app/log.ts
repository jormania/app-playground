import type { ChallengeGame } from './challenges/records'
import type { KeyValueStore } from './store'
import { K } from './store'

/**
 * The engagement log: what the taster exists to learn (KEYPATH_TUTOR.md §6).
 * Local only. Each record carries its profile and time, so the whole log can
 * be uploaded as-is when a family account exists.
 */
export type LogEvent =
  | { type: 'session_start' }
  | { type: 'session_end'; durationMs: number }
  | { type: 'door_opened'; door: Door }
  /** Back on Home from a door: where the door's time stops (Progress). */
  | { type: 'door_left'; door: Door }
  | { type: 'setting_changed'; key: string; from: unknown; to: unknown }
  | { type: 'profile_created' }
  /** `part` when a part of it was started (learning in parts; 'whole' is the whole song as the last part). */
  | { type: 'song_started'; songId: string; practice: string; tempo: number; mode: string; part?: string }
  /** Home's Today card, all three done (logged once a day, the first time Home sees it). */
  | { type: 'today_done' }
  /** A part played to its end: learnt (passed) or not, with its wrong keys. */
  | { type: 'song_part'; songId: string; practice: string; part: string; passed: boolean; wrong: number }
  | { type: 'song_finished'; songId: string; practice: string; stars: number; score: number; hit: number; total: number; wrong: number }
  | { type: 'song_abandoned'; songId: string; practice: string; hit: number; total: number }
  | { type: 'song_added' }
  | { type: 'song_renamed'; songId: string }
  | { type: 'song_removed'; songId: string }
  /** One bar practised on its own from the report, until clean (done) or left; bar as she saw it (from 1), tempo where it ended. */
  | { type: 'song_loop'; songId: string; practice: string; bar: number; passes: number; done: boolean; tempo: number }
  /** "Listen first": the song played for her before she tries it. */
  | { type: 'song_listened'; songId: string; practice: string; tempo: number }
  /** A step up offered: after a song (songId) or at a Journey milestone (step). */
  | { type: 'suggestion'; setting: string; to: string; accepted: boolean; songId?: string; step?: string }
  /** The connection wizard: finished, or left at a step (where people get stuck). */
  | { type: 'keyboard_setup'; outcome: 'done' | 'left'; step: string; ms: number }
  /** The keyboard vanished mid-song; on the Poco F3, suspect Xiaomi's OTG timeout (KEYPATH.md §2). */
  | { type: 'keyboard_lost'; songId: string }
  /** Journey: a practice or check begun; `testOut` when the step was still locked. */
  | { type: 'journey_started'; step: string; mode: 'practice' | 'check'; testOut: boolean }
  | { type: 'journey_finished'; step: string; mode: 'practice' | 'check'; passed: boolean; wrong: number; ms: number }
  | { type: 'journey_left'; step: string; mode: 'practice' | 'check'; ms: number }
  /** Studio: opened from its door or from a song's "Make it yours". */
  | { type: 'studio_opened'; from: 'door' | 'song'; songId?: string }
  | { type: 'studio_recorded'; ms: number; notes: number; style: boolean; songId?: string; countIn?: number; click?: boolean }
  | { type: 'studio_kept'; takeId: string }
  | { type: 'studio_played'; takeId: string; via: 'keyboard' | 'phone' }
  | { type: 'studio_favourite'; takeId: string; on: boolean }
  | { type: 'studio_deleted'; takeId: string }
  | { type: 'studio_renamed'; takeId: string }
  | { type: 'studio_exported'; takeId: string; outcome: 'shared' | 'cancelled' | 'saved' | 'error' }
  /** Challenges: a game begun, finished (score, whether it beat the best) or left part-way. */
  | { type: 'challenge_started'; game: ChallengeGame; level: number }
  | { type: 'challenge_finished'; game: ChallengeGame; level: number; score: number; best: boolean; wrong?: number; ms: number }
  | { type: 'challenge_left'; game: ChallengeGame; level: number; ms: number }

export type Door = 'songs' | 'journey' | 'challenges' | 'studio'

export type LogRecord = LogEvent & { at: string; profileId: string }

export class EngagementLog {
  // Appends are chained so two quick events can't read the same old list and
  // lose one of the writes.
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly store: KeyValueStore) {}

  add(profileId: string, event: LogEvent, now = new Date()): Promise<void> {
    this.queue = this.queue.then(async () => {
      const records = (await this.store.get<LogRecord[]>(K.log(profileId))) ?? []
      records.push({ ...event, at: now.toISOString(), profileId })
      await this.store.set(K.log(profileId), records)
    })
    return this.queue
  }

  /** Resolves once every append so far has been written. */
  settled(): Promise<void> {
    return this.queue
  }

  async read(profileId: string): Promise<LogRecord[]> {
    await this.queue
    return (await this.store.get<LogRecord[]>(K.log(profileId))) ?? []
  }
}
