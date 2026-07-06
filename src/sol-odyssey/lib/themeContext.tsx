import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyPreset,
  loadPreset,
  modeOf,
  nextPreset,
  presetById,
  savePreset,
  THEME_KEY,
  type Preset,
  type PresetId,
  type Theme,
} from './theme'

interface ThemeContextValue {
  /** The chosen preset id. */
  preset: PresetId
  /** The full preset record (name, mode, swatch…). */
  current: Preset
  /** The resolved light/dark mode of the current preset (drives the header glyph). */
  mode: Theme
  /** Set a preset explicitly (the Settings picker). */
  setPreset: (id: PresetId) => void
  /** Header cycle button — advance to the next preset (wraps; flips light↔dark each press). */
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PresetId>(() => loadPreset())

  // Apply + persist whenever the preset changes.
  useEffect(() => {
    applyPreset(preset)
    savePreset(preset)
  }, [preset])

  // Live sync with the field guide (and other tabs).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPresetState(loadPreset())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      preset,
      current: presetById(preset),
      mode: modeOf(preset),
      setPreset: (id) => setPresetState(id),
      cycle: () => setPresetState((p) => nextPreset(p)),
    }),
    [preset],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
