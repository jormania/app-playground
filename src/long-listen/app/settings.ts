import { readJson, writeJson } from '../../shared/storage'
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '../domain/week'

/**
 * Per-device settings, in localStorage. Deliberately small: nothing here is
 * part of the journey (that lives in IndexedDB), and none of it is a server
 * secret — the passphrase unlocks this listener's curator, the Spotify Client
 * ID is public by design.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

export interface Settings {
  passphrase: string
  timeZone: string
  spotifyClientId: string
  theme: ThemeChoice
  /** Development only: answer from canned demo programmes instead of Claude. */
  demo: boolean
}

export const SETTINGS_KEY = 'long-listen:settings'
export const THEME_KEY = 'long-listen:theme'

const ENV_CLIENT_ID = (import.meta.env?.VITE_LONG_LISTEN_SPOTIFY_CLIENT_ID as string | undefined) ?? ''

export function loadSettings(): Settings {
  const raw = readJson<Partial<Settings>>(SETTINGS_KEY, {})
  const theme = readJson<unknown>(THEME_KEY, 'system')
  return {
    passphrase: typeof raw.passphrase === 'string' ? raw.passphrase : '',
    timeZone: typeof raw.timeZone === 'string' && isValidTimeZone(raw.timeZone) ? raw.timeZone : DEFAULT_TIME_ZONE,
    spotifyClientId: typeof raw.spotifyClientId === 'string' && raw.spotifyClientId ? raw.spotifyClientId : ENV_CLIENT_ID,
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    demo: Boolean(import.meta.env?.DEV) && raw.demo === true,
  }
}

export function saveSettings(s: Settings): void {
  const { theme, ...rest } = s
  writeJson(SETTINGS_KEY, rest)
  writeJson(THEME_KEY, theme)
}
