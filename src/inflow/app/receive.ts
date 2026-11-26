/**
 * Marking an expected payment received, from any screen (audit B-02, B-03, E-01). The rule is
 * `lib/receive.ts`; this adds the date's exchange rate, the tax reserve suggestion and the saves.
 */
import { useCallback } from 'react'
import type { IncomeRecord } from '../domain/types'
import { lastRate } from '../lib/guards'
import { fetchRonRate, money } from '../lib/money'
import { receive } from '../lib/receive'
import { suggestReserve } from '../tax/estimate'
import { shortDate } from '../lib/dates'
import { useInflow } from './state'

export interface ReceiveOptions {
  /** In the payment's currency; omitted means all of it. */
  amount?: number
  /** Omitted means today. */
  date?: string
}

export function useReceive() {
  const { data, settings, today, saveRecord, toast } = useInflow()
  return useCallback(async (r: IncomeRecord, opts: ReceiveOptions = {}): Promise<IncomeRecord | null> => {
    const date = opts.date ?? today
    const amount = opts.amount ?? r.amount
    // The rate of the day it arrived; offline, the last rate used for that currency, else the expected one.
    const fxRate = r.currency === 'RON' ? 1 : (await fetchRonRate(r.currency, date)) ?? lastRate(r.currency, data.records) ?? r.fxRate
    const others = data.records.filter((x) => x.id !== r.id)
    const costs = settings.features.costs ? data.costs : []
    const suggest = (x: IncomeRecord) => (settings.features.tax && x.taxability === 'taxable'
      ? (() => { const s = suggestReserve(x, others, settings.tax, today, costs); return { amount: s.amount, rulesId: s.rulesId } })()
      : null)
    let result
    try {
      result = receive(r, { amount, date, fxRate }, suggest)
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'danger' })
      return null
    }
    const saved = await saveRecord(result.received)
    if (!saved) return null
    if (result.remaining) {
      const rest = await saveRecord(result.remaining)
      if (!rest) {
        toast({ message: `Saved the ${money(amount, r.currency)} received, but the balance could not be updated: edit the expected payment.`, tone: 'danger', duration: 10000 })
        return saved
      }
      toast({ message: `Received ${money(amount, r.currency)} on ${shortDate(date)}; ${money(result.remaining.amount, r.currency)} still expected`, tone: 'success' })
    } else {
      toast({ message: `Marked received: ${money(amount, r.currency)}`, tone: 'success' })
    }
    return saved
  }, [data.records, data.costs, settings.features, settings.tax, today, saveRecord, toast])
}
