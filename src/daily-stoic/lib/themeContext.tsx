import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSystemThemeFollow } from '../../shared/theme.ts'
import {
  applyTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
  syncThemeColor,
  THEME_KEY,
  type Theme,
  type ThemePref,
} from './theme'

interface ThemeContextValue {
  /** The stored preference: system / light / dark. */
  theme: ThemePref
  /** What it resolves to right now. */
  resolved: Theme
  setTheme: (pref: ThemePref) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => loadTheme())

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  // Follow the OS while on "system". The palette itself swaps in CSS, but the
  // browser-chrome tint would go stale the moment the device flips at sunset —
  // which is why this app re-syncs only the tint where the other two repaint.
  // The subscription is shared (R-026); the callback is not.
  useSystemThemeFollow(theme === 'system', () => syncThemeColor('system'))

  // Live sync with the field guide (and other tabs).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setThemeState(loadTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved: resolveTheme(theme), setTheme: setThemeState }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
