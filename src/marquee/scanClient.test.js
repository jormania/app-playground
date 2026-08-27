// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { runScan, loadSnapshot, saveSnapshot, loadLastScan } from './scanClient.js'

// The client half of the scan had no tests at all: the diff itself was covered
// (changes.test.js), but the wiring around it — which venues count as having
// answered, what gets carried forward when one doesn't, and what the saved scan
// remembers about the check BEFORE it — was not.

const venue = (over = {}) => ({
  id: 'v1', name: 'Teatrul Excelsior', url: 'https://teatrul-excelsior.ro/program/',
  adapter: 'excelsior', status: 'active', category: 'play', ...over,
})

const event = (over = {}) => ({
  key: 'excelsior:2026-09-05T20:00:tomcat',
  venue: 'Teatrul Excelsior', title: 'Tomcat', date: '2026-09-05', time: '20:00',
  ticketState: 'none', ...over,
})

/** A stand-in endpoint: whatever it is handed comes back as the scan result. */
const endpoint = (body) => async () => ({ ok: true, json: async () => body })

const answered = (events, over = {}) => ({
  scannedAt: '2026-08-27T09:00:00.000Z',
  venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events }],
  events,
  ...over,
})

beforeEach(() => { localStorage.clear() })

describe('runScan', () => {
  it('says so, and asks for nothing, when every venue is paused', async () => {
    const result = await runScan([venue({ status: 'paused' })], { fetchImpl: endpoint(answered([])) })
    expect(result.nothingToScan).toBe(true)
    expect(result.events).toEqual([])
  })

  it('establishes a baseline silently on the first check', async () => {
    const result = await runScan([venue()], { fetchImpl: endpoint(answered([event()])) })
    expect(result.hadSnapshot).toBe(false)
    expect(result.changes).toEqual([])
    expect(Object.keys(loadSnapshot().events)).toHaveLength(1)
  })

  it('reports what changed against the check before it', async () => {
    await runScan([venue()], { fetchImpl: endpoint(answered([event()])) })
    const result = await runScan([venue()], {
      fetchImpl: endpoint(answered([event({ ticketState: 'open' })])),
    })
    expect(result.changes.map((c) => c.kind)).toEqual(['tickets-opened'])
  })

  it('remembers WHEN the previous check ran, so a reload keeps the claim honest', async () => {
    // "Nothing new since Tuesday" is a claim about the gap between two checks.
    // Held only in component state, the earlier end of it was lost on reload and
    // the strip fell back to reporting the gap as ending at the very check you
    // were looking at ("nothing new since earlier today", after a week's gap).
    await runScan([venue()], { fetchImpl: endpoint(answered([event()], { scannedAt: '2026-08-20T09:00:00.000Z' })) })
    const second = await runScan([venue()], { fetchImpl: endpoint(answered([event()])) })
    expect(second.previousScanAt).toBe('2026-08-20T09:00:00.000Z')
    expect(loadLastScan().previousScanAt).toBe('2026-08-20T09:00:00.000Z')
  })

  it('carries a silent venue’s programme forward instead of calling it cancelled', async () => {
    // A throttled venue contributes no events. Letting that absence clear its
    // snapshot would empty the app on every hiccup and refill it next time as if
    // everything were brand new.
    saveSnapshot({
      scannedAt: '2026-08-26T09:00:00.000Z',
      events: { [event().key]: { ticketState: 'none', date: '2026-09-05', title: 'Tomcat', venue: 'Teatrul Excelsior', time: '20:00' } },
    })
    const throttled = {
      scannedAt: '2026-08-27T09:00:00.000Z',
      venues: [{ venue: 'Teatrul Excelsior', status: 'throttled', events: [] }],
      events: [],
    }
    const result = await runScan([venue()], { fetchImpl: endpoint(throttled) })
    expect(result.changes).toEqual([])
    expect(loadSnapshot().events[event().key]).toBeTruthy()
  })

  it('surfaces the endpoint’s own message rather than a bare status code', async () => {
    const failing = async () => ({ ok: false, status: 429, json: async () => ({ message: 'Too many requests — try again shortly.' }) })
    await expect(runScan([venue()], { fetchImpl: failing })).rejects.toThrow(/Too many requests/)
  })
})
