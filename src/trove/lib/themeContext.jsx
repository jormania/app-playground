import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyTheme, loadThemePref, saveThemePref, toggleTheme, THEME_KEY } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => loadThemePref())

  useEffect(() => {
    applyTheme(theme)
    saveThemePref(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_KEY) setTheme(loadThemePref())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme(toggleTheme) }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
