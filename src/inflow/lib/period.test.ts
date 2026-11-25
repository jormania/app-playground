import { describe, expect, it } from 'vitest'
import { buckets, comparableSoFar, previousRange, resolvePeriod } from './period'

const today = '2026-11-25' // a Wednesday

describe('resolvePeriod', () => {
  it('starts weeks on Monday', () => {
    expect(resolvePeriod({ preset: 'week' }, today)).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
  })
  it('resolves month, last month and year', () => {
    expect(resolvePeriod({ preset: 'month' }, today)).toMatchObject({ from: '2026-11-01', to: '2026-11-30' })
    expect(resolvePeriod({ preset: 'last_month' }, '2026-03-31')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
    expect(resolvePeriod({ preset: 'year' }, today)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('orders a reversed custom range', () => {
    expect(resolvePeriod({ preset: 'custom', from: '2026-05-10', to: '2026-05-01' }, today)).toMatchObject({ from: '2026-05-01', to: '2026-05-10' })
  })
})

describe('previousRange', () => {
  it('is the previous equivalent period', () => {
    expect(previousRange({ preset: 'week' }, today)).toMatchObject({ from: '2026-11-16', to: '2026-11-22' })
    expect(previousRange({ preset: 'month' }, '2026-03-15')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
    expect(previousRange({ preset: 'last_month' }, today)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(previousRange({ preset: 'custom', from: '2026-05-11', to: '2026-05-20' }, today)).toMatchObject({ from: '2026-05-01', to: '2026-05-10' })
  })
  it('compares a running month against the same days of the last one', () => {
    const cur = resolvePeriod({ preset: 'month' }, today)
    const prev = previousRange({ preset: 'month' }, today)
    expect(comparableSoFar(cur, prev, today)).toMatchObject({ from: '2026-10-01', to: '2026-10-25' })
    // A finished period compares whole.
    expect(comparableSoFar(resolvePeriod({ preset: 'last_month' }, today), prev, today)).toEqual(prev)
  })
})

describe('buckets', () => {
  it('uses days for a week, weeks for a month, months for a year', () => {
    expect(buckets(resolvePeriod({ preset: 'week' }, today)).map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    const month = buckets(resolvePeriod({ preset: 'month' }, today))
    expect(month[0]).toMatchObject({ from: '2026-11-01', to: '2026-11-01' }) // 1 Nov 2026 is a Sunday
    expect(month[month.length - 1].to).toBe('2026-11-30')
    expect(buckets(resolvePeriod({ preset: 'year' }, today))).toHaveLength(12)
  })
  it('covers every day exactly once', () => {
    const bs = buckets({ from: '2026-01-15', to: '2026-03-20' })
    for (let i = 1; i < bs.length; i++) expect(bs[i].from > bs[i - 1].to).toBe(true)
    expect(bs[0].from).toBe('2026-01-15')
    expect(bs[bs.length - 1].to).toBe('2026-03-20')
  })
})
