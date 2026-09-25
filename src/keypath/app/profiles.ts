import { DEFAULT_SETTINGS, type JudgeSettings } from '../engine'
import { K, PREFIX, type KeyValueStore } from './store'

export type Language = 'en' | 'ro'
/** 'auto' follows the language: C D E in English, Do Re Mi in Romanian. */
export type NoteNames = 'auto' | 'letters' | 'solfege' | 'both'

export interface Profile {
  id: string
  name: string
  avatar: string
  createdAt: string
}

export interface ProfileSettings extends JudgeSettings {
  language: Language
  noteNames: NoteNames
  /** Names printed on the on-screen keys. Off once she knows where the notes are (the falling notes keep theirs). */
  keyNames: boolean
  /** Finger numbers on the falling notes, and on the staff while practising. Only songs that carry fingering show any. */
  fingers: boolean
  /** A coach's note under the report, written by Claude, when the phone has a key (songs/coach.ts). */
  coach: boolean
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_SETTINGS,
  language: 'en',
  noteNames: 'auto',
  keyNames: true,
  fingers: true,
  coach: true,
}

/** Picked when creating a profile — a face, not a photo. */
export const AVATARS = ['🐺', '🦊', '🦉', '🐱', '🐢', '🦄', '🐸', '🐼', '🐙', '🦋'] as const

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`)

export class ProfileRepo {
  constructor(private readonly store: KeyValueStore) {}

  async list(): Promise<Profile[]> {
    return (await this.store.get<Profile[]>(K.profiles)) ?? []
  }

  async create(name: string, avatar: string, now = new Date()): Promise<Profile> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('A profile needs a name')
    const profile: Profile = { id: newId(), name: trimmed.slice(0, 40), avatar, createdAt: now.toISOString() }
    await this.store.set(K.profiles, [...(await this.list()), profile])
    await this.store.set(K.settings(profile.id), DEFAULT_PROFILE_SETTINGS)
    return profile
  }

  /** A new name or face for a player. A blank name keeps the old one. */
  async update(profileId: string, patch: { name?: string; avatar?: string }): Promise<void> {
    const name = patch.name?.trim().slice(0, 40)
    await this.store.set(
      K.profiles,
      (await this.list()).map((p) => (p.id === profileId ? { ...p, ...(name ? { name } : {}), ...(patch.avatar ? { avatar: patch.avatar } : {}) } : p)),
    )
  }

  /** The profile this phone opens into — "pinned" by simply remembering it. */
  async current(): Promise<Profile | null> {
    const id = await this.store.get<string>(K.current)
    return (await this.list()).find((p) => p.id === id) ?? null
  }

  async setCurrent(id: string | null): Promise<void> {
    if (id === null) await this.store.del(K.current)
    else await this.store.set(K.current, id)
  }

  async settings(profileId: string): Promise<ProfileSettings> {
    // Merge over the defaults so a setting added in a later version has a value.
    return { ...DEFAULT_PROFILE_SETTINGS, ...((await this.store.get<Partial<ProfileSettings>>(K.settings(profileId))) ?? {}) }
  }

  /**
   * Delete a player and everything that is theirs on this phone: settings,
   * the engagement log, Journey progress, Studio takes — every key that ends
   * in their id, so data added in later versions goes too. Songs added to
   * the phone are the family's and stay.
   */
  async remove(profileId: string): Promise<void> {
    await this.store.set(
      K.profiles,
      (await this.list()).filter((p) => p.id !== profileId),
    )
    if ((await this.store.get<string>(K.current)) === profileId) await this.store.del(K.current)
    for (const key of await this.store.keys()) if (key.startsWith(PREFIX) && key.endsWith(`:${profileId}`)) await this.store.del(key)
  }

  async saveSettings(profileId: string, settings: ProfileSettings): Promise<void> {
    await this.store.set(K.settings(profileId), settings)
  }
}
