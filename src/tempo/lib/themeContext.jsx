import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSystemThemeFollow } from '../../shared/theme.ts'
import { applyTheme, loadThemePref, nextPref, resolveTheme, saveThemePref, THEME_KEY } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(() => loadThemePref())
  const resolved = resolveTheme(pref)

  useEffect(() => {
    applyTheme(resolved)
    saveThemePref(pref)
  }, [pref, resolved])

  // Re-resolve when the OS scheme flips while on "system". The subscription is
  // shared (R-026) and brings a Safari < 14 fallback this copy never had; what
  // to do about the flip stays here, because the three apps that follow the OS
  // each want something different done.
  useSystemThemeFollow(pref === 'system', () => applyTheme(resolveTheme('system')))

  // Live-sync with the guide (and other tabs).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_KEY) setPref(loadThemePref())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      pref,
      resolved,
      setTheme: (p) => setPref(p),
      cycle: () => setPref((p) => nextPref(p)),
    }),
    [pref, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
