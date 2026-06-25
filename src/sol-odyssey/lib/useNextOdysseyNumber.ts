import { useQuery } from '@tanstack/react-query'
import { isConfigured } from './settings'
import { useSettings } from './settingsContext'
import { fetchNextOdysseyInfo, type NextOdysseyInfo } from './notion'

export const ODYSSEY_HISTORY_KEY = ['odysseyHistory'] as const

/** Has the user run Odysseys before, and what number is next — so the empty home says "your
 *  first Odyssey" only for genuine first-timers, and "Begin Odyssey N" thereafter. */
export function useNextOdysseyNumber() {
  const { settings } = useSettings()
  return useQuery<NextOdysseyInfo, Error>({
    queryKey: ODYSSEY_HISTORY_KEY,
    queryFn: () => fetchNextOdysseyInfo(settings),
    enabled: isConfigured(settings),
  })
}
