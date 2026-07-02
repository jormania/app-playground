// Theme (light / dark / system). Mirrors Sol Odyssey's pattern: one dedicated localStorage key
// shared by BOTH the app and the standalone guide (same origin), so a single choice drives both
// and a `storage` event keeps open pages in sync. Keep in step with the inline FOUC script in
// tempo-react.html and tempo-guide.html.

export const THEME_KEY = 'tempo:theme'

// Browser-chrome colour per resolved theme (soft cream / deep calm night).
const THEME_COLOR = { light: '#F4F6F3', dark: '#12151A' }

export function systemPrefersDark() {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function resolveTheme(pref) {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref === 'dark' ? 'dark' : 'light'
}

export function loadThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'dark' || v === 'system' ? v : 'light'
  } catch {
    return 'light'
  }
}

export function saveThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* quota / private mode */
  }
}

// Quick toggle flips between light and dark (no system in the UI). Any legacy
// 'system' preference resolves to a concrete theme, then toggles from there.
export function nextPref(pref) {
  return resolveTheme(pref) === 'dark' ? 'light' : 'dark'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}
