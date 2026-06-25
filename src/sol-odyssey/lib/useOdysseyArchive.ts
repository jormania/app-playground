import { useQuery } from '@tanstack/react-query'
import { isConfigured } from './settings'
import { useSettings } from './settingsContext'
import { listAllOdysseys, type OdysseyDetail } from './notion'

export const ODYSSEY_ARCHIVE_KEY = ['odysseyArchive'] as const

/** Every Odyssey (any status), newest first — for the Stats screen. */
export function useOdysseyArchive() {
  const { settings } = useSettings()
  return useQuery<OdysseyDetail[], Error>({
    queryKey: ODYSSEY_ARCHIVE_KEY,
    queryFn: () => listAllOdysseys(settings),
    enabled: isConfigured(settings),
  })
}
