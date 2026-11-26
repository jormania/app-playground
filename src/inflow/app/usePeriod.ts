import { useMemo } from 'react'
import { earned, received, recovered, summarise } from '../lib/analytics'
import { comparableSoFar, previousRange, resolvePeriod } from '../lib/period'
import { useInflow } from './state'

/**
 * The selected period, its comparison period, and their received records. `cur` and `before`
 * are service payments (what the work earned); cost recovery is kept apart (`curRecovery`) and
 * enters the summary on its own line.
 */
export function usePeriodData() {
  const { books: data, period, today } = useInflow()
  return useMemo(() => {
    const range = resolvePeriod(period, today)
    const prevWhole = previousRange(period, today)
    // While the period is still running, compare against the same stretch of the last one.
    const prev = comparableSoFar(range, prevWhole, today)
    const all = received(data.records, range)
    const allBefore = received(data.records, prev)
    const cur = earned(all)
    const before = earned(allBefore)
    const curRecovery = recovered(all)
    return { range, prev, prevWhole, cur, before, curRecovery, summary: summarise(cur, curRecovery), prevSummary: summarise(before, recovered(allBefore)) }
  }, [data.records, period, today])
}
