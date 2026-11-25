import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { IncomeRecord } from '../domain/types'
import { asExpected, suggestExpected } from './analytics'

const base = buildDemo('2026-11-25').records[0]
const rec = (id: string, clientId: string, date: string, extra: Partial<IncomeRecord> = {}): IncomeRecord =>
  ({ ...base, id, clientId, date, amount: 1300, amountRon: 1300, currency: 'RON', fxRate: 1, status: 'received', recurring: true, sessions: 4, hours: null, taxReserve: 200, demo: undefined, ...extra })
const today = '2026-11-25'

describe('expected payments suggested from recurring ones', () => {
  it('offers next month from the last recurring payment, same amount', () => {
    const s = suggestExpected([rec('1', 'ioana', '2026-10-03'), rec('2', 'ioana', '2026-11-03')], today)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ key: 'ioana:2026-12-03', date: '2026-12-03' })
    const e = asExpected(s[0])
    expect(e).toMatchObject({ id: '', status: 'expected', date: '2026-12-03', amount: 1300, sessions: 4, clientId: 'ioana', taxReserve: null, reserveSource: null })
  })

  it('stays quiet when something is already expected, for one-offs, gone-quiet clients and dismissals', () => {
    expect(suggestExpected([rec('1', 'a', '2026-11-03'), rec('2', 'a', '2026-12-03', { status: 'expected' })], today)).toEqual([])
    expect(suggestExpected([rec('1', 'a', '2026-11-03', { recurring: false })], today)).toEqual([])
    // Last paid in August: September's date is long past, so it is not a suggestion.
    expect(suggestExpected([rec('1', 'a', '2026-08-03')], today)).toEqual([])
    expect(suggestExpected([rec('1', 'a', '2026-11-03')], today, new Set(['a:2026-12-03']))).toEqual([])
  })

  it('keeps month ends sensible', () => {
    expect(suggestExpected([rec('1', 'a', '2026-10-31')], '2026-11-20')[0].date).toBe('2026-11-30')
  })
})
