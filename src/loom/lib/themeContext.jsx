import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyTheme, loadThemePref, saveThemePref, nextTheme, presetById, THEME_KEY } from './theme.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => loadThemePref())

  useEffect(() => {
    applyTheme(themeId)
    saveThemePref(themeId)
  }, [themeId])

  // Live-sync with the guide (and other tabs) via the shared storage key.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === THEME_KEY) setThemeId(loadThemePref()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(() => ({
    themeId,
    preset: presetById(themeId),
    setTheme: setThemeId,
    cycle: () => setThemeId(nextTheme),
  }), [themeId])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
