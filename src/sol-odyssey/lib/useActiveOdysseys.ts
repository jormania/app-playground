import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isConfigured } from './settings'
import { useSettings } from './settingsContext'
import { harvestOdyssey, listActiveOdysseys, updateTinyVersion, type HarvestArgs, type OdysseyDetail } from './notion'

export const ACTIVE_ODYSSEYS_KEY = ['activeOdysseys'] as const

/** Shared source of truth for "is there an Active Odyssey" — used by the home, the wizard, and
 *  Settings, so they always agree (one cached read). Only runs once Settings are complete. */
export function useActiveOdysseys() {
  const { settings } = useSettings()
  return useQuery<OdysseyDetail[], Error>({
    queryKey: ACTIVE_ODYSSEYS_KEY,
    queryFn: () => listActiveOdysseys(settings),
    enabled: isConfigured(settings),
  })
}

/** Apply a weekly adjustment to the active Odyssey's tiny version (so the daily loop reminds you of
 *  the new, smaller thing). Refreshes the active read so Today/Overview update at once. */
export function useUpdateTinyVersion() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<void, Error, { odysseyId: string; value: string }>({
    mutationFn: ({ odysseyId, value }) => updateTinyVersion(settings, odysseyId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY }),
  })
}

/** Harvest the active Odyssey (sets Outcome + Status). On success it leaves "active", so refresh
 *  the active list and the per-Odyssey caches. */
export function useHarvestOdyssey() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<OdysseyDetail, Error, HarvestArgs>({
    mutationFn: (args) => harvestOdyssey(settings, args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY })
      queryClient.invalidateQueries({ queryKey: ['odysseyHistory'] })
      queryClient.invalidateQueries({ queryKey: ['odysseyArchive'] })
      queryClient.invalidateQueries({ queryKey: ['hasCompleted'] })
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      queryClient.invalidateQueries({ queryKey: ['reflections'] })
    },
  })
}
