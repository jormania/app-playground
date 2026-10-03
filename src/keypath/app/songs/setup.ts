import type { Practice, Song } from '../../engine'
import { K, type KeyValueStore } from '../store'
import { ratedLevel } from './level'

// What a player chose on a song's setup last time (KEYPATH_ROADMAP.md, "Remember
// each song's setup"): the hands, the speed and how the notes are shown, per
// song, so practising the left hand at 75% is still there tomorrow. Which part comes next is worked out
// from what she has learnt (parts.ts), not remembered.

export const SPEEDS = ['1', '0.75', '0.5'] as const
export type Speed = (typeof SPEEDS)[number]

/** How the notes are shown: falling onto the keys, or written on the staff alone (the read-it view). */
export type NotesView = 'falling' | 'written'

export interface SongSetup {
  practice: Practice
  speed: Speed
  /** Unset is falling, as every song was before the written view. */
  view?: NotesView
}

/**
 * The speed a song opens at when she hasn't chosen one: full, except for the
 * easy version of a song that is still rated Harder. The easy version thins
 * the notes but can't slow a fast tune, and a first try shouldn't be the
 * hardest one.
 */
export const suggestedSpeed = (song: Song): Speed => (song.easy && ratedLevel(song) === 3 ? '0.75' : '1')

export class SetupRepo {
  constructor(private readonly store: KeyValueStore) {}

  async get(profileId: string, songId: string): Promise<SongSetup | null> {
    const all = (await this.store.get<Record<string, Partial<SongSetup>>>(K.setup(profileId))) ?? {}
    const s = all[songId]
    if (!s) return null
    return {
      practice: s.practice === 'left' || s.practice === 'both' ? s.practice : 'right',
      speed: SPEEDS.includes(s.speed as Speed) ? (s.speed as Speed) : '1',
      ...(s.view === 'written' ? { view: 'written' as const } : {}),
    }
  }

  async set(profileId: string, songId: string, setup: SongSetup): Promise<void> {
    const all = (await this.store.get<Record<string, SongSetup>>(K.setup(profileId))) ?? {}
    await this.store.set(K.setup(profileId), { ...all, [songId]: setup })
  }
}
