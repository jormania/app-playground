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
  | { type: 'setting_changed'; key: string; from: unknown; to: unknown }
  | { type: 'profile_created' }
  | { type: 'song_started'; songId: string; practice: string; tempo: number; mode: string }
  | { type: 'song_finished'; songId: string; practice: string; stars: number; score: number; hit: number; total: number; wrong: number }
  | { type: 'song_abandoned'; songId: string; practice: string; hit: number; total: number }
  | { type: 'song_added' }
  | { type: 'suggestion'; setting: string; to: string; accepted: boolean; songId: string }
  /** The connection wizard: finished, or left at a step (where people get stuck). */
  | { type: 'keyboard_setup'; outcome: 'done' | 'left'; step: string; ms: number }
  /** The keyboard vanished mid-song; on the Poco F3, suspect Xiaomi's OTG timeout (KEYPATH.md §2). */
  | { type: 'keyboard_lost'; songId: string }

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

  async read(profileId: string): Promise<LogRecord[]> {
    await this.queue
    return (await this.store.get<LogRecord[]>(K.log(profileId))) ?? []
  }
}
