import { DEFAULT_SETTINGS, type JudgeSettings } from '../engine'
import { K, type KeyValueStore } from './store'

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
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_SETTINGS,
  language: 'en',
  noteNames: 'auto',
  keyNames: true,
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

  async saveSettings(profileId: string, settings: ProfileSettings): Promise<void> {
    await this.store.set(K.settings(profileId), settings)
  }
}
