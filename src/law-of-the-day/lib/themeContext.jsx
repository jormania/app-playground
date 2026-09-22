import { createContext, useContext, useMemo } from 'react'
import { useThemeSync } from '../../shared/theme.ts'
import { applyTheme, loadThemePref, saveThemePref, toggleTheme, THEME_KEY } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // Shared mechanism (R-015), local vocabulary. The storage listener inside
  // useThemeSync is what live-syncs with the guide page and other tabs.
  const [theme, setTheme] = useThemeSync(THEME_KEY, {
    load: loadThemePref,
    save: saveThemePref,
    apply: applyTheme,
  })

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme(toggleTheme) }),
    [theme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
