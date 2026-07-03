// Theme (light / dark only). One dedicated localStorage key so the Cabinet's
// choice doesn't collide with any sub-app's own theme storage. Keep in step
// with the inline FOUC script in cabinet.html.

export const THEME_KEY = 'cabinet:theme'

// Browser-chrome colour per theme — matches App.module.css's .shell gradient stops.
const THEME_COLOR = { light: '#f4eeda', dark: '#100d0a' }

export function loadThemePref() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveThemePref(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // quota / private mode
  }
}

export function toggleTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}
