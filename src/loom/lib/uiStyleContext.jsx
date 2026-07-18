import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { UISTYLE_KEY, loadUiStyle, saveUiStyle } from './uiStyle.js'

const UiStyleContext = createContext(null)

export function UiStyleProvider({ children }) {
  const [style, setStyleState] = useState(() => loadUiStyle())

  useEffect(() => { saveUiStyle(style) }, [style])

  useEffect(() => {
    const onStorage = (e) => { if (e.key === UISTYLE_KEY) setStyleState(loadUiStyle()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(() => ({ style, setStyle: setStyleState }), [style])
  return <UiStyleContext.Provider value={value}>{children}</UiStyleContext.Provider>
}

export function useUiStyle() {
  const ctx = useContext(UiStyleContext)
  if (!ctx) throw new Error('useUiStyle must be used within a UiStyleProvider')
  return ctx
}
