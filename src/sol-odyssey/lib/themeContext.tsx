import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useThemeSync } from '../../shared/theme.ts'
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
  // Apply, persist, and live-sync with the field guide (and other tabs) — the
  // shared mechanism (R-026 step 3). The vocabulary stays local: a preset id,
  // not a light/dark pair, which is exactly why only the mechanism moved.
  const [preset, setPresetState] = useThemeSync<PresetId>(THEME_KEY, {
    load: loadPreset,
    save: savePreset,
    apply: applyPreset,
  })

  const value = useMemo<ThemeContextValue>(
    () => ({
      preset,
      current: presetById(preset),
      mode: modeOf(preset),
      setPreset: (id) => setPresetState(id),
      cycle: () => setPresetState((p) => nextPreset(p)),
    }),
    // setPresetState is useState's setter, reached through useThemeSync, so it
    // is stable — named here because eslint cannot see through the hook.
    [preset, setPresetState],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
