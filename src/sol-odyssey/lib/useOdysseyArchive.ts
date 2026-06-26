import { useQuery } from '@tanstack/react-query'
import { isConfigured } from './settings'
import { useSettings } from './settingsContext'
import { fetchHasCompleted, listAllOdysseys, type OdysseyDetail } from './notion'

export const ODYSSEY_ARCHIVE_KEY = ['odysseyArchive'] as const
export const HAS_COMPLETED_KEY = ['hasCompleted'] as const

/** Every Odyssey (any status), newest first — for the Stats screen. */
export function useOdysseyArchive() {
  const { settings } = useSettings()
  return useQuery<OdysseyDetail[], Error>({
    queryKey: ODYSSEY_ARCHIVE_KEY,
    queryFn: () => listAllOdysseys(settings),
    enabled: isConfigured(settings),
  })
}

/** A cheap boolean for the Stats nav gate — avoids loading the whole archive on every app boot
 *  just to know whether any Odyssey has been completed. */
export function useHasCompleted() {
  const { settings } = useSettings()
  return useQuery<boolean, Error>({
    queryKey: HAS_COMPLETED_KEY,
    queryFn: () => fetchHasCompleted(settings),
    enabled: isConfigured(settings),
  })
}
