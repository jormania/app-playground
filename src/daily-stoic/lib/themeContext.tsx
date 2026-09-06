import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  // browser-chrome tint would go stale the moment the device flips at sunset.
  useEffect(() => {
    if (theme !== 'system' || typeof matchMedia === 'undefined') return undefined
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => syncThemeColor('system')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [theme])

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
