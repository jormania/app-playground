import { useMemo } from 'react'
import { received, summarise } from '../lib/analytics'
import { comparableSoFar, previousRange, resolvePeriod } from '../lib/period'
import { useInflow } from './state'

/** The selected period, its comparison period, and their received records. */
export function usePeriodData() {
  const { data, period, today } = useInflow()
  return useMemo(() => {
    const range = resolvePeriod(period, today)
    const prevWhole = previousRange(period, today)
    // While the period is still running, compare against the same stretch of the last one.
    const prev = comparableSoFar(range, prevWhole, today)
    const cur = received(data.records, range)
    const before = received(data.records, prev)
    return { range, prev, prevWhole, cur, before, summary: summarise(cur), prevSummary: summarise(before) }
  }, [data.records, period, today])
}
