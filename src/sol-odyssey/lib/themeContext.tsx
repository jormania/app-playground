import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  loadThemePref,
  nextTheme,
  resolveTheme,
  saveThemePref,
  THEME_KEY,
  type Theme,
  type ThemePref,
} from './theme'

interface ThemeContextValue {
  /** The user's preference (light / dark / system). */
  pref: ThemePref
  /** The palette actually applied right now. */
  resolved: Theme
  /** Set the preference explicitly (e.g. the Settings control). */
  setTheme: (pref: ThemePref) => void
  /** Quick header toggle — flips to the opposite of what's currently shown (an explicit choice). */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>(() => loadThemePref())
  const resolved = resolveTheme(pref)

  // Apply + persist whenever the preference (or its resolution) changes.
  useEffect(() => {
    applyTheme(resolved)
    saveThemePref(pref)
  }, [pref, resolved])

  // Re-resolve when the OS scheme changes while on "system".
  useEffect(() => {
    if (pref !== 'system' || typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  // Live sync with the field guide (and other tabs).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPref(loadThemePref())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      pref,
      resolved,
      setTheme: (p) => setPref(p),
      toggle: () => setPref(nextTheme(resolved)),
    }),
    [pref, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
