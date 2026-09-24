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
