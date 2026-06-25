import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSettings } from './settingsContext'
import { listReflections, upsertReflection, type UpsertReflectionArgs } from './notion'
import type { ReflectionRecord } from './reflections'
import { enqueue, reflectionItem } from './queue'
import { isNetworkError, isOnline, notifySyncChanged } from './sync'

export const reflectionsKey = (odysseyId: string) => ['reflections', odysseyId] as const

/** One cached read of all weekly reflections — powers the Weekly screen and the Tracker's
 *  temperature sparkline. */
export function useReflections(odysseyId: string | undefined) {
  const { settings } = useSettings()
  return useQuery<ReflectionRecord[], Error>({
    queryKey: reflectionsKey(odysseyId ?? 'none'),
    queryFn: () => listReflections(settings, odysseyId as string),
    enabled: Boolean(odysseyId),
  })
}

interface UpsertResult {
  queued: boolean
}

export function useUpsertReflection(odysseyId: string | undefined) {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const key = reflectionsKey(odysseyId ?? 'none')

  return useMutation<UpsertResult, Error, UpsertReflectionArgs, { prev?: ReflectionRecord[] }>({
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<ReflectionRecord[]>(key)
      const optimistic: ReflectionRecord = {
        id: args.existingId ?? `local:week-${args.weekIndex}`,
        weekIndex: args.weekIndex,
        date: args.dateISO,
        ...args.draft,
      }
      queryClient.setQueryData<ReflectionRecord[]>(key, (old = []) =>
        [...old.filter((r) => r.weekIndex !== args.weekIndex), optimistic].sort(
          (a, b) => a.weekIndex - b.weekIndex,
        ),
      )
      return { prev }
    },
    mutationFn: async (args): Promise<UpsertResult> => {
      const park = () =>
        enqueue(
          reflectionItem({ id: args.odysseyId, number: args.odysseyNumber }, args.weekIndex, args.dateISO, args.draft),
        )
      if (!isOnline()) {
        await park()
        return { queued: true }
      }
      try {
        await upsertReflection(settings, args)
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
