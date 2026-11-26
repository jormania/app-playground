import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { IncomeRecord } from '../domain/types'
import { receive } from './receive'

const demo = buildDemo('2026-11-25')
const expected: IncomeRecord = { ...demo.records.find((r) => r.status === 'expected' && r.currency === 'GBP')!, taxReserve: null, reserveSource: null, sessions: 2, hours: 3, taxWithheld: 100 }
const suggest = (r: IncomeRecord) => ({ amount: Math.round(r.amountRon * 0.2), rulesId: 'RO-2026' })

describe('marking an expected payment received (audit B-02, B-03, E-01)', () => {
  it('all of it: the same record, received on the day, at that day\'s rate, with a reserve suggested', () => {
    const { received, remaining } = receive(expected, { amount: expected.amount, date: '2026-11-30', fxRate: 6.1 }, suggest)
    expect(remaining).toBeNull()
    expect(received).toMatchObject({ id: expected.id, status: 'received', date: '2026-11-30', fxRate: 6.1, amountRon: Math.round(expected.amount * 6.1 * 100) / 100, reserveSource: 'suggested', taxRules: 'RO-2026' })
    expect(received.taxReserve).toBe(Math.round(received.amountRon * 0.2))
  })

  it('a reserve set by hand is kept, not replaced by a suggestion', () => {
    const mine = { ...expected, taxReserve: 300, reserveSource: 'manual' as const }
    expect(receive(mine, { amount: mine.amount, date: '2026-11-30', fxRate: 6 }, suggest).received).toMatchObject({ taxReserve: 300, reserveSource: 'manual' })
  })

  it('part of it: a new received payment for the part, and the balance stays expected, sessions counted once', () => {
    const part = expected.amount * 0.4
    const { received, remaining } = receive(expected, { amount: part, date: '2026-11-30', fxRate: 6 }, suggest)
    expect(received.id).toBe('')
    expect(received).toMatchObject({ status: 'received', amount: Math.round(part * 100) / 100, sessions: 2, hours: 3, taxWithheld: 40 })
    expect(remaining).toMatchObject({ id: expected.id, status: 'expected', sessions: 0, hours: null, taxWithheld: 60 })
    expect(remaining!.amount + received.amount).toBeCloseTo(expected.amount, 2)
    expect(remaining!.notes).toMatch(/Balance after/)
  })

  it('then the balance: received in full later, with no second set of sessions', () => {
    const first = receive(expected, { amount: expected.amount / 2, date: '2026-11-30', fxRate: 6 }, suggest)
    const second = receive(first.remaining!, { amount: first.remaining!.amount, date: '2026-12-15', fxRate: 6.05 }, suggest)
    expect(second.remaining).toBeNull()
    expect(first.received.sessions + second.received.sessions).toBe(2)
  })

  it('refuses more than expected, nothing, or a payment already received', () => {
    expect(() => receive(expected, { amount: expected.amount + 1, date: '2026-11-30', fxRate: 6 })).toThrow(/more than is expected/)
    expect(() => receive(expected, { amount: 0, date: '2026-11-30', fxRate: 6 })).toThrow()
    expect(() => receive({ ...expected, status: 'received' }, { amount: 1, date: '2026-11-30', fxRate: 6 })).toThrow()
  })
})
