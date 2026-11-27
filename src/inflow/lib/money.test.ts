// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { delta, fetchRonRate } from './money'

const ok = (rate: number) => (async () => ({ ok: true, json: async () => ({ rates: { RON: rate } }) })) as unknown as typeof fetch
const offline = (async () => { throw new Error('offline') }) as unknown as typeof fetch

describe('the day\'s ECB rate', () => {
  beforeEach(() => localStorage.clear())
  it('is fetched for the payment\'s date, kept, and served from memory when offline', async () => {
    expect(await fetchRonRate('EUR', '2026-11-20', ok(5.0912))).toBe(5.0912)
    expect(await fetchRonRate('EUR', '2026-11-20', offline)).toBe(5.0912)
    // Another day was never fetched: nothing to offer, the form falls back to your last rate.
    expect(await fetchRonRate('EUR', '2026-11-21', offline)).toBeNull()
    expect(await fetchRonRate('RON', '2026-11-21', offline)).toBe(1)
  })
})

describe('delta: a real change never reads as none', () => {
  it('keeps one decimal under 1%, whole percents above, ±0% only for no change', () => {
    const t = (c: number, p: number) => delta(c, p).text
    // 13,937 against 13,887: +50 lei is +0.36%.
    expect([t(13937, 13887), t(13837, 13887), t(100005, 100000), t(10097, 10000), t(11200, 10000), t(13887, 13887), t(5, 0), t(0, 0)])
      .toEqual(['+0.4%', '−0.4%', '+<0.1%', '+1%', '+12%', '±0%', 'new', '—'])
  })
  it('under half a percent is still "about the same" for summaries', () => {
    expect([delta(13937, 13887).direction, delta(10097, 10000).direction, delta(9900, 10000).direction]).toEqual(['flat', 'up', 'down'])
  })
})
