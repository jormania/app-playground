import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyTheme, loadThemePref, nextPref, resolveTheme, saveThemePref, THEME_KEY } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(() => loadThemePref())
  const resolved = resolveTheme(pref)

  useEffect(() => {
    applyTheme(resolved)
    saveThemePref(pref)
  }, [pref, resolved])

  // Re-resolve when the OS scheme flips while on "system".
  useEffect(() => {
    if (pref !== 'system' || typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  // Live-sync with the guide (and other tabs).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_KEY) setPref(loadThemePref())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      pref,
      resolved,
      setTheme: (p) => setPref(p),
      cycle: () => setPref((p) => nextPref(p)),
    }),
    [pref, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
