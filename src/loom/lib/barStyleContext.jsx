import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BARSTYLE_KEY, loadBarStyle, saveBarStyle } from './barStyle.js'

const BarStyleContext = createContext(null)

export function BarStyleProvider({ children }) {
  const [style, setStyleState] = useState(() => loadBarStyle())

  useEffect(() => { saveBarStyle(style) }, [style])

  useEffect(() => {
    const onStorage = (e) => { if (e.key === BARSTYLE_KEY) setStyleState(loadBarStyle()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(() => ({ style, setStyle: setStyleState }), [style])
  return <BarStyleContext.Provider value={value}>{children}</BarStyleContext.Provider>
}

export function useBarStyle() {
  const ctx = useContext(BarStyleContext)
  if (!ctx) throw new Error('useBarStyle must be used within a BarStyleProvider')
  return ctx
}
