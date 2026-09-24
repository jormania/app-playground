import { createContext, useContext } from 'react'
import type { EngagementLog } from './log'
import type { Profile, ProfileRepo, ProfileSettings } from './profiles'
import type { KeyValueStore } from './store'
import type { StringKey } from './i18n'

export interface KeyPathApp {
  store: KeyValueStore
  profiles: ProfileRepo
  log: EngagementLog
  /** The current player, or null before one is chosen. */
  profile: Profile | null
  settings: ProfileSettings
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** Change one setting for the current player; logged. */
  updateSetting: <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => Promise<void>
  choose: (profile: Profile | null) => Promise<void>
  /** Delete a player and all their data on this phone (for testing and starting over). */
  removeProfile: (profile: Profile) => Promise<void>
  /** Reload profiles and settings after a restore. */
  reload: () => Promise<void>
}

export const AppContext = createContext<KeyPathApp | null>(null)

export function useApp(): KeyPathApp {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp outside <Shell>')
  return app
}
