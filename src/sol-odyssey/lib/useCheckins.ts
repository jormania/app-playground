import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSettings } from './settingsContext'
import { listCheckins, upsertCheckin, type UpsertCheckinArgs } from './notion'
import type { CheckinRecord } from './checkins'
import { checkinItem, enqueue } from './queue'
import { isNetworkError, isOnline, notifySyncChanged } from './sync'

export const checkinsKey = (odysseyId: string) => ['checkins', odysseyId] as const

/** One cached read of all check-ins for the active Odyssey — powers Today, the Tracker, and the
 *  streak (spec: not 42 separate reads). */
export function useCheckins(odysseyId: string | undefined) {
  const { settings } = useSettings()
  return useQuery<CheckinRecord[], Error>({
    queryKey: checkinsKey(odysseyId ?? 'none'),
    queryFn: () => listCheckins(settings, odysseyId as string),
    enabled: Boolean(odysseyId),
  })
}

interface UpsertResult {
  queued: boolean
}

/** Save today's check-in: optimistic in the cache immediately, written to Notion if online, or
 *  parked in the offline queue if not (synced later by the SyncProvider). */
export function useUpsertCheckin(odysseyId: string | undefined) {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const key = checkinsKey(odysseyId ?? 'none')

  return useMutation<UpsertResult, Error, UpsertCheckinArgs, { prev?: CheckinRecord[] }>({
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<CheckinRecord[]>(key)
      const optimistic: CheckinRecord = {
        id: args.existingId ?? `local:${args.dateISO}`,
        date: args.dateISO,
        dayIndex: args.dayIndex,
        ...args.draft,
      }
      queryClient.setQueryData<CheckinRecord[]>(key, (old = []) =>
        [...old.filter((r) => r.date !== args.dateISO), optimistic].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      )
      return { prev }
    },
    mutationFn: async (args): Promise<UpsertResult> => {
      const park = () =>
        enqueue(
          checkinItem({ id: args.odysseyId, number: args.odysseyNumber }, args.dateISO, args.dayIndex, args.draft),
        )
      if (!isOnline()) {
        await park()
        return { queued: true }
      }
      try {
        await upsertCheckin(settings, args)
        return { queued: false }
      } catch (err) {
        if (isNetworkError(err)) {
          await park()
          return { queued: true }
        }
        throw err
      }
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      if (odysseyId) queryClient.invalidateQueries({ queryKey: key })
      notifySyncChanged()
    },
  })
}
