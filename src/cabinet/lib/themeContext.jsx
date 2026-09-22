import { createContext, useContext, useMemo } from 'react'
import { useThemeSync } from '../../shared/theme.ts'
import { applyTheme, loadThemePref, saveThemePref, toggleTheme, THEME_KEY } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // The persist-and-cross-tab-sync mechanism is shared (R-015); the vocabulary —
  // light/dark, and what "toggle" means — stays here in ./theme.
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
