// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fetchRonRate } from './money'

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
