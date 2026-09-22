import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSystemThemeFollow, useThemeSync } from '../../shared/theme.ts'
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
  // Apply, persist, and live-sync with the field guide (and other tabs) — the
  // shared mechanism (R-026 step 4). The three-way system/light/dark vocabulary
  // and normalizeTheme's legacy mapping stay in ./theme.
  const [theme, setThemeState] = useThemeSync<ThemePref>(THEME_KEY, {
    load: loadTheme,
    save: saveTheme,
    apply: applyTheme,
  })

  // Follow the OS while on "system". The palette itself swaps in CSS, but the
  // browser-chrome tint would go stale the moment the device flips at sunset —
  // which is why this app re-syncs only the tint where the other two repaint.
  // The subscription is shared (R-026); the callback is not.
  useSystemThemeFollow(theme === 'system', () => syncThemeColor('system'))

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved: resolveTheme(theme), setTheme: setThemeState }),
    // setThemeState is useState's setter, reached through useThemeSync, so it
    // is stable — named here because eslint cannot see through the hook.
    [theme, setThemeState],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
