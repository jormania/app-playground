import { K, type KeyValueStore } from '../store'
import type { Recording } from './recorder'

/** A take she chose to keep. Takes stay on this phone, with the player who made them. */
export interface Take extends Recording {
  id: string
  /** "Take 3": numbered per player, never reused. */
  n: number
  createdAt: string
  favourite: boolean
  /** A Style was running on the keyboard while she recorded (it isn't in the take). */
  style: boolean
  /** Made from a song's "Make it yours". */
  songId?: string
  songTitle?: string
}

/** Kept takes per player. At the limit, one has to go before another is kept. */
export const MAX_KEPT = 50

export class TakeRepo {
  constructor(private readonly store: KeyValueStore) {}

  /** Newest first. */
  async list(profileId: string): Promise<Take[]> {
    const all = (await this.store.get<Take[]>(K.studio(profileId))) ?? []
    return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async keep(profileId: string, r: Recording, meta: Pick<Take, 'style' | 'songId' | 'songTitle'>, now = new Date()): Promise<Take | null> {
    const all = (await this.store.get<Take[]>(K.studio(profileId))) ?? []
    if (all.length >= MAX_KEPT) return null
    const n = all.reduce((m, t) => Math.max(m, t.n), 0) + 1
    const take: Take = { ...r, ...meta, id: `take:${now.getTime().toString(36)}:${n}`, n, createdAt: now.toISOString(), favourite: false }
    await this.store.set(K.studio(profileId), [...all, take])
    return take
  }

  async update(profileId: string, id: string, patch: Partial<Pick<Take, 'favourite'>>): Promise<void> {
    const all = (await this.store.get<Take[]>(K.studio(profileId))) ?? []
    await this.store.set(
      K.studio(profileId),
      all.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    )
  }

  async remove(profileId: string, id: string): Promise<void> {
    const all = (await this.store.get<Take[]>(K.studio(profileId))) ?? []
    await this.store.set(
      K.studio(profileId),
      all.filter((t) => t.id !== id),
    )
  }
}
