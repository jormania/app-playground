// Theme (light / dark). The chosen theme lives in a single dedicated localStorage key shared by
// BOTH the app and the standalone field guide (same origin), so one choice drives both and a
// `storage` event keeps open pages in sync. Pure-ish helpers here; the React wiring is in
// themeContext.tsx. Keep this in step with the inline FOUC script in sol-odysseys-react.html and
// the guide.

/** The user's preference. `system` follows the OS `prefers-color-scheme`. */
export type ThemePref = 'light' | 'dark' | 'system'
/** The actually-applied palette. */
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'sol-odyssey:theme'

/** The browser-chrome colour per resolved theme (the dark canvas / brand accent). */
const THEME_COLOR: Record<Theme, string> = { light: '#4B45C6', dark: '#121127' }

/** Does the OS currently prefer dark? (false where matchMedia is unavailable.) */
export function systemPrefersDark(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Resolve a preference to the palette to actually apply. */
export function resolveTheme(pref: ThemePref): Theme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(explicit?: StorageLike): StorageLike | null {
  if (explicit) return explicit
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* locked-down context */
  }
  return null
}

/** Read the stored preference, defaulting to light. */
export function loadThemePref(explicit?: StorageLike): ThemePref {
  try {
    const v = storage(explicit)?.getItem(THEME_KEY)
    return v === 'dark' || v === 'system' ? v : 'light'
  } catch {
    return 'light'
  }
}

/** Persist the preference. No-op if storage is unavailable. */
export function saveThemePref(pref: ThemePref, explicit?: StorageLike): void {
  try {
    storage(explicit)?.setItem(THEME_KEY, pref)
  } catch {
    /* quota / private mode */
  }
}

/** The opposite of a resolved palette — for the header quick-toggle. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

/** Apply a resolved palette to the document: the `data-theme` attribute (drives the token palette)
 *  and the browser-chrome `theme-color`. Safe to call where there's no DOM. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}
