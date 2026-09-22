import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useThemeSync, useSystemThemeFollow } from '../../shared/theme.ts'
import {
  applyTheme,
  loadThemePref,
  saveThemePref,
  nextThemePref,
  resolveTheme,
  themePrefLabel,
  THEME_KEY,
} from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // Shared mechanism (R-015), local vocabulary. The storage listener inside
  // useThemeSync is what live-syncs with the guide page and other tabs.
  const [pref, setPref] = useThemeSync(THEME_KEY, {
    load: loadThemePref,
    save: saveThemePref,
    apply: applyTheme,
  })

  // The painted theme is kept in state, not derived at render, because under
  // `system` it can change with nothing in React having changed — the OS
  // flipping at sunset. The effect below is the only thing that observes that.
  const [theme, setTheme] = useState(() => resolveTheme(pref))

  useEffect(() => {
    setTheme(resolveTheme(pref))
  }, [pref])

  // The subscription is shared (R-026); what to do when the OS flips stays
  // here, because the three apps that follow the OS each want something
  // different done about it.
  useSystemThemeFollow(pref === 'system', () => {
    applyTheme('system')
    setTheme(resolveTheme('system'))
  })

  const value = useMemo(
    () => ({
      pref,
      theme,
      label: themePrefLabel(pref),
      cycle: () => setPref(nextThemePref),
    }),
    [pref, theme, setPref],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
