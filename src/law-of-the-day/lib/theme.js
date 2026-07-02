// Theme (light / dark only — deliberately no "system" option, unlike Tempo's
// theme.js). One dedicated localStorage key shared by both the app and the
// standalone guide (same origin), so a single choice drives both and a
// `storage` event keeps open pages in sync. Keep in step with the inline
// FOUC script in law-of-the-day-react.html and law-of-the-day-guide.html.

export const THEME_KEY = 'lawofday:theme'

// Browser-chrome colour per theme (matches ds/tokens.css --color-bg-sunken).
const THEME_COLOR = { light: '#f4f5f7', dark: '#0e1115' }

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
