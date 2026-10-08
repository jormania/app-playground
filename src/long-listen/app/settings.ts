import { readJson, writeJson } from '../../shared/storage'
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '../domain/week'

/**
 * Per-device settings, in localStorage. Nothing here is part of the journey
 * (that lives in IndexedDB). Two of them are the listener's own credentials —
 * the Anthropic key and the Notion token — kept on this device the way every
 * app in the playground keeps them (Dev — Building an App, "bring your own
 * key"), and sent only to Anthropic and through the shared Notion relay.
 * The Spotify Client ID is public by design; Spotify's own sign-in never
 * passes a password through this app.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

export interface Settings {
  /** The listener's Anthropic key. Kept on this device; sent only to Anthropic. */
  anthropicKey: string
  /** The listener's Notion integration token, used through the shared /api/notion relay. */
  notionToken: string
  /** The Notion page holding the notebook's databases (a link or an id). */
  notionPage: string
  /** Reading comfort. */
  textSize: 'standard' | 'large'
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
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    anthropicKey: str(raw.anthropicKey),
    notionToken: str(raw.notionToken),
    notionPage: str(raw.notionPage),
    textSize: raw.textSize === 'large' ? 'large' : 'standard',
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
