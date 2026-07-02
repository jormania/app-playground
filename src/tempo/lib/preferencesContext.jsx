import { createContext, useContext, useState } from 'react'
import { savePreferences } from './storage'
import { loadPlayerPreferences } from './preferences'

// A single shared source of truth for Settings — mirrors themeContext.jsx.
// Every screen that can open Settings (home screen, Player) reads/writes the
// same in-memory state, so a change made on one screen is reflected on the
// other immediately, not just the next time it happens to remount.
const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(loadPlayerPreferences)

  function updatePreferences(patch) {
    setPreferences((prev) => {
      const next = { ...prev, ...patch }
      savePreferences(next)
      return next
    })
  }

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
