import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type Settings } from './settings'

interface SettingsContextValue {
  settings: Settings
  /** Persist a partial change to the device and update the app immediately. */
  update: (patch: Partial<Settings>) => void
  /** Re-read from storage (e.g. after an external change). */
  reload: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update: (patch) => setSettings(saveSettings(patch)),
      reload: () => setSettings(loadSettings()),
    }),
    [settings],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
