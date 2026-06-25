import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isConfigured } from './settings'
import { useSettings } from './settingsContext'
import { ACTIVE_ODYSSEYS_KEY } from './useActiveOdysseys'
import { ODYSSEY_HISTORY_KEY } from './useNextOdysseyNumber'
import { ODYSSEY_ARCHIVE_KEY } from './useOdysseyArchive'
import {
  activatePlanningOdyssey,
  discardPlanningDraft,
  listPlanningOdyssey,
  savePlanningDraft,
  type OdysseyDetail,
  type OdysseyRef,
} from './notion'
import type { CharterDraft } from './charter'

export const PLANNING_ODYSSEY_KEY = ['planningOdyssey'] as const

/** The single Planning (draft) Odyssey, or null. Shared by the home, Overview, and the wizard so
 *  they always agree on whether a draft is lined up. Only runs once Settings are complete. */
export function usePlanningOdyssey() {
  const { settings } = useSettings()
  return useQuery<OdysseyDetail | null, Error>({
    queryKey: PLANNING_ODYSSEY_KEY,
    queryFn: () => listPlanningOdyssey(settings),
    enabled: isConfigured(settings),
  })
}

/** Upsert the Planning draft (save progress). Refreshes the planning + history caches (a brand-new
 *  draft can affect the empty-home readout). */
export function useSavePlanningDraft() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<OdysseyRef, Error, { draft: CharterDraft; existingId?: string }>({
    mutationFn: ({ draft, existingId }) => savePlanningDraft(settings, draft, existingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANNING_ODYSSEY_KEY })
      queryClient.invalidateQueries({ queryKey: ODYSSEY_HISTORY_KEY })
    },
  })
}

/** Promote the draft to Active. On success the draft is gone and an Odyssey is Active, so refresh
 *  the planning, active, history, and archive caches. */
export function useActivatePlanningOdyssey() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<OdysseyDetail, Error, { draftId: string; draft: CharterDraft }>({
    mutationFn: ({ draftId, draft }) => activatePlanningOdyssey(settings, draftId, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANNING_ODYSSEY_KEY })
      queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY })
      queryClient.invalidateQueries({ queryKey: ODYSSEY_HISTORY_KEY })
      queryClient.invalidateQueries({ queryKey: ODYSSEY_ARCHIVE_KEY })
    },
  })
}

/** Discard (archive) the draft. */
export function useDiscardPlanningDraft() {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (draftId) => discardPlanningDraft(settings, draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLANNING_ODYSSEY_KEY })
    },
  })
}
