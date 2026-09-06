// Theme: system / light / dark — the same three-way choice Marquee uses.
//
// "system" stores no palette of its own: it CLEARS the data-theme attribute so
// tokens.css's own `prefers-color-scheme` block takes over, which means the app
// keeps following the OS when it flips at sunset. A stored 'light' or 'dark'
// never would. The `<meta name="theme-color">` that tints browser chrome can't
// be driven from CSS, so it is set here.
//
// The choice lives in one localStorage key shared with the standalone field
// guide (same origin), so one setting drives both and a `storage` event keeps
// open pages in sync. Keep this in step with the pre-paint script in
// daily-stoic-react.html and the guide's own.

/** The stored preference. */
export type ThemePref = 'system' | 'light' | 'dark'

/** What the preference resolves to right now. */
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'daily-stoic:theme'

export const DEFAULT_THEME: ThemePref = 'system'

/** Browser-chrome colour per resolved mode — the palette's canvas. */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#4B45C6',
  dark: '#121127',
}

/** The eight palettes Daily Stoic used to cycle through, mapped to the two that
 *  remain. Anyone carrying a stored preset id lands on the right side of the
 *  light/dark line rather than being dumped back to the default. */
const LEGACY_DARK = ['indigo-dark', 'octagon', 'ristretto', 'spectrum']
const LEGACY_LIGHT = ['indigo-light', 'quiet-light', 'filter-sun', 'solarized-light']

export function normalizeTheme(raw: string | null | undefined): ThemePref {
  if (raw === 'system' || raw === 'light' || raw === 'dark') return raw
  if (raw && LEGACY_DARK.includes(raw)) return 'dark'
  if (raw && LEGACY_LIGHT.includes(raw)) return 'light'
  return DEFAULT_THEME
}

/** Does the OS currently prefer dark? (false where matchMedia is unavailable.) */
export function systemPrefersDark(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** What the preference means right now — "system" asks the OS. */
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

/** Read the stored preference, migrating the old preset ids. */
export function loadTheme(explicit?: StorageLike): ThemePref {
  try {
    return normalizeTheme(storage(explicit)?.getItem(THEME_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

/** Persist the choice. No-op if storage is unavailable. */
export function saveTheme(pref: ThemePref, explicit?: StorageLike): void {
  try {
    storage(explicit)?.setItem(THEME_KEY, pref)
  } catch {
    /* quota / private mode */
  }
}

/** Apply a preference to the document. Safe to call where there's no DOM. */
export function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  syncThemeColor(pref)
}

/** Point `<meta name="theme-color">` at the resolved palette's canvas. */
export function syncThemeColor(pref: ThemePref): void {
  if (typeof document === 'undefined') return
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[resolveTheme(pref)])
}
