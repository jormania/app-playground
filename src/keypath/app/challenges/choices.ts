import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { K, update } from '../store'

/**
 * A game's choice (its level; how Note race shows the note), kept per player
 * the way a song's setup is, so a game she plays at level 3 opens at level 3
 * tomorrow. A stored value that isn't one of `allowed` reads as `initial`.
 * `allowed` is a module constant, so it never changes between renders.
 */
export function useGameChoice<T extends string | number>(name: string, initial: T, allowed: readonly T[]): [T, (value: T) => void] {
  const { store, profile } = useApp()
  const [value, setValue] = useState<T>(initial)
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (!profileId) return
    let live = true
    void store.get<Record<string, unknown>>(K.games(profileId)).then((all) => {
      const v = all?.[name]
      if (live && allowed.includes(v as T)) setValue(v as T)
    })
    return () => {
      live = false
    }
  }, [store, profileId, name, allowed])

  const choose = (v: T) => {
    setValue(v)
    if (profileId) void update<Record<string, unknown>>(store, K.games(profileId), (all = {}) => ({ ...all, [name]: v }))
  }
  return [value, choose]
}

/** Every game has three levels. */
export const GAME_LEVELS = [1, 2, 3] as const
/** How Note race shows the note to find. */
export const RACE_MODES = ['names', 'staff'] as const
