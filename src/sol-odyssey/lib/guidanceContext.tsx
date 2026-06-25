import { createContext, useContext, type ReactNode } from 'react'

/** Whether companion-guidance twisties should render anywhere in the app. Driven by the
 *  `showGuidance` setting and provided once at the app root, so `SupportingNote` can opt out
 *  without every screen threading the flag. */
const GuidanceContext = createContext<boolean>(true)

export function GuidanceProvider({ show, children }: { show: boolean; children: ReactNode }) {
  return <GuidanceContext.Provider value={show}>{children}</GuidanceContext.Provider>
}

export function useShowGuidance(): boolean {
  return useContext(GuidanceContext)
}
