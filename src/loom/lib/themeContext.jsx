import { createContext, useContext, useMemo } from 'react'
import { useThemeSync } from '../../shared/theme.ts'
import { applyTheme, loadThemePref, saveThemePref, nextTheme, presetById, THEME_KEY } from './theme.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // Shared mechanism (R-015). Loom's vocabulary is a preset id rather than a
  // light/dark pair, which is exactly why only the mechanism moved.
  const [themeId, setThemeId] = useThemeSync(THEME_KEY, {
    load: loadThemePref,
    save: saveThemePref,
    apply: applyTheme,
  })

  const value = useMemo(() => ({
    themeId,
    preset: presetById(themeId),
    setTheme: setThemeId,
    cycle: () => setThemeId(nextTheme),
  }), [themeId, setThemeId])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
