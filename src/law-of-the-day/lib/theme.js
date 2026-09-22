// Theme — three-way: `system` (the default), `light`, `dark`.
//
// `system` is what a fresh install gets, so the app matches whatever the phone
// is already doing; the toolbar button cycles System → Light → Dark → System,
// which keeps the override *and* the way back to automatic on one control.
//
// One dedicated localStorage key shared by the app and the two standalone
// static pages (same origin), so a single choice drives all three and a
// `storage` event keeps open pages in sync. Keep in step with the inline FOUC
// scripts in law-of-the-day-react.html, law-of-the-day-guide.html and
// law-of-the-day-laws.html.
import { systemPrefersDark } from '../../shared/theme.ts'

export const THEME_KEY = 'lawofday:theme'

// Browser-chrome colour per *resolved* theme (matches --lotd-grad-a in
// palette.css — the top of the shell gradient, which is what sits under the
// status bar).
const THEME_COLOR = { light: '#fdf8ec', dark: '#12141c' }

const PREFS = ['system', 'light', 'dark']

/** The stored preference, or `system` for anything unrecognised or unreadable.
 *  Note the old two-state vocabulary is forward-compatible: a stored `dark`
 *  or `light` from before this change still reads as an explicit override. */
export function loadThemePref() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return PREFS.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    // quota / private mode
  }
}

/** Preference → the theme actually painted. Only `system` consults the OS. */
export function resolveTheme(pref, win) {
  if (pref === 'dark' || pref === 'light') return pref
  return systemPrefersDark(win) ? 'dark' : 'light'
}

/** System → Light → Dark → System. */
export function nextThemePref(pref) {
  const i = PREFS.indexOf(pref)
  return PREFS[(i + 1) % PREFS.length]
}

export function themePrefLabel(pref) {
  if (pref === 'light') return 'Light'
  if (pref === 'dark') return 'Dark'
  return 'System'
}

export function applyTheme(pref) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', resolved)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved])
}
