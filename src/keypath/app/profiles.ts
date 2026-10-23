import { DEFAULT_SETTINGS, type JudgeSettings } from '../engine'
import { exclusive, K, PREFIX, type KeyValueStore } from './store'

export type Language = 'en' | 'ro'
/** 'auto' follows the language: C D E in English, Do Re Mi in Romanian. */
export type NoteNames = 'auto' | 'letters' | 'solfege' | 'both'

/**
 * A player's PIN, kept as a salted hash. It is there to stop a mix-up on a phone
 * more than one person plays on (a sibling opening Nora's progress by mistake),
 * not to keep anyone out: whoever has the phone can remove it (`forgotPin`).
 */
export interface PinRecord {
  salt: string
  hash: string
}

export interface Profile {
  id: string
  name: string
  avatar: string
  createdAt: string
  pin?: PinRecord
}

export const PIN_LENGTH = 4
export const isPin = (s: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(s)

/** SHA-256 of the salt and PIN, where the browser has it; a plain string hash where it doesn't. Either way, only a hash is kept. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const text = `${salt}:${pin}`
  try {
    const subtle = globalThis.crypto?.subtle
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    /* fall through */
  }
  let h = 5381
  for (const c of text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  return `x${h.toString(16)}`
}

export interface ProfileSettings extends JudgeSettings {
  language: Language
  noteNames: NoteNames
  /** Names printed on the on-screen keys. Off once she knows where the notes are (the falling notes keep theirs). */
  keyNames: boolean
  /** Finger numbers on the falling notes, and on the staff while practising. Only songs that carry fingering show any. */
  fingers: boolean
  /** The music written on a staff above the falling notes: this bar and the next (songs/ScoreStrip.tsx). */
  score: boolean
  /** Finger numbers fade from a song once she has learnt it (its whole song played through), and stay on new ones. */
  fingersFade: boolean
  /** A coach's note under the report, written by Claude, when the phone has a key (songs/coach.ts). */
  coach: boolean
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_SETTINGS,
  language: 'en',
  noteNames: 'auto',
  keyNames: true,
  fingers: true,
  fingersFade: true,
  score: false,
  coach: true,
}

const ONE_OF = {
  language: ['en', 'ro'],
  noteNames: ['auto', 'letters', 'solfege', 'both'],
  onWrong: ['keepGoing', 'show', 'wait'],
  timing: ['relaxed', 'normal', 'strict'],
  report: ['off', 'short', 'detailed'],
} as const satisfies Partial<Record<keyof ProfileSettings, readonly string[]>>

/**
 * A player's settings as stored, made whole: a setting added in a later
 * version gets its default, and a value that isn't one of its own (a damaged
 * or hand-edited backup, a choice a later version retired) is the default
 * too. An unknown language would otherwise leave every screen without words.
 */
export function normaliseSettings(stored: unknown): ProfileSettings {
  const s = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {}
  const out: Record<string, unknown> = { ...DEFAULT_PROFILE_SETTINGS }
  for (const [key, fallback] of Object.entries(DEFAULT_PROFILE_SETTINGS)) {
    const v = s[key]
    const allowed = (ONE_OF as Record<string, readonly string[]>)[key]
    if (allowed ? typeof v === 'string' && allowed.includes(v) : typeof v === typeof fallback) out[key] = v
  }
  return out as unknown as ProfileSettings
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
    await exclusive(this.store, K.profiles, async () => this.store.set(K.profiles, [...(await this.list()), profile]))
    await this.store.set(K.settings(profile.id), DEFAULT_PROFILE_SETTINGS)
    return profile
  }

  /** A new name or face for a player. A blank name keeps the old one. */
  async update(profileId: string, patch: { name?: string; avatar?: string }): Promise<void> {
    const name = patch.name?.trim().slice(0, 40)
    await exclusive(this.store, K.profiles, async () =>
      this.store.set(
        K.profiles,
        (await this.list()).map((p) => (p.id === profileId ? { ...p, ...(name ? { name } : {}), ...(patch.avatar ? { avatar: patch.avatar } : {}) } : p)),
      ),
    )
  }

  /** Set a player's PIN (four digits), or take it off with `null`. Returns false for something that isn't four digits. */
  async setPin(profileId: string, pin: string | null): Promise<boolean> {
    if (pin !== null && !isPin(pin)) return false
    const salt = newId()
    const record = pin === null ? undefined : { salt, hash: await hashPin(pin, salt) }
    await exclusive(this.store, K.profiles, async () =>
      this.store.set(
        K.profiles,
        (await this.list()).map((p) => {
          if (p.id !== profileId) return p
          const { pin: _old, ...rest } = p
          return record ? { ...rest, pin: record } : rest
        }),
      ),
    )
    return true
  }

  /** Whether this is the player's PIN. A player with none accepts anything. */
  async checkPin(profile: Profile, pin: string): Promise<boolean> {
    if (!profile.pin) return true
    return (await hashPin(pin, profile.pin.salt)) === profile.pin.hash
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
    return normaliseSettings(await this.store.get<unknown>(K.settings(profileId)))
  }

  /**
   * Delete a player and everything that is theirs on this phone: settings,
   * the engagement log, Journey progress, Studio takes — every key that ends
   * in their id, so data added in later versions goes too. Songs added to
   * the phone are the family's and stay.
   */
  async remove(profileId: string): Promise<void> {
    await exclusive(this.store, K.profiles, async () =>
      this.store.set(
        K.profiles,
        (await this.list()).filter((p) => p.id !== profileId),
      ),
    )
    if ((await this.store.get<string>(K.current)) === profileId) await this.store.del(K.current)
    for (const key of await this.store.keys()) if (key.startsWith(PREFIX) && key.endsWith(`:${profileId}`)) await this.store.del(key)
  }

  async saveSettings(profileId: string, settings: ProfileSettings): Promise<void> {
    await this.store.set(K.settings(profileId), settings)
  }

  /** Change a player's settings from what is stored at that moment, one change at a time. Returns them as saved. */
  updateSettings(profileId: string, change: (current: ProfileSettings) => ProfileSettings): Promise<ProfileSettings> {
    return exclusive(this.store, K.settings(profileId), async () => {
      const next = normaliseSettings(change(await this.settings(profileId)))
      await this.store.set(K.settings(profileId), next)
      return next
    })
  }
}
