import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettings } from './settingsContext'
import { ACTIVE_ODYSSEYS_KEY } from './useActiveOdysseys'
import { PLANNING_ODYSSEY_KEY } from './usePlanningOdyssey'
import { ODYSSEY_ARCHIVE_KEY } from './useOdysseyArchive'
import { writeCommitment } from './notion'

/** Save (or clear) the forfeit-on-lapse contract on an Odyssey, then refresh whatever readout shows
 *  it (the active Odyssey, the planned draft, the archive). */
export function useWriteCommitment() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<void, Error, { odysseyId: string; contract: string }>({
    mutationFn: ({ odysseyId, contract }) => writeCommitment(settings, odysseyId, contract),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY })
      queryClient.invalidateQueries({ queryKey: PLANNING_ODYSSEY_KEY })
      queryClient.invalidateQueries({ queryKey: ODYSSEY_ARCHIVE_KEY })
    },
  })
}
