// @vitest-environment jsdom
/**
 * The provider's own guarantees, driven as the screens use them: a restore that can be
 * undone and never destroys data when it fails (audit B-07).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { memoryStore, type KeyValueStore } from '../../shared/kvStore'
import { buildDemo } from '../data/demo'
import type { InflowData } from '../domain/types'
import { makeBackup } from '../store/backup'
import { DATA_KEY } from '../store/repo'
import { CACHE_KEY, NotionRepo } from '../store/notion'
import { SETTINGS_KEY } from '../store/settings'
import { InflowProvider, PRE_RESTORE_KEY, useInflow } from './state'

const today = '2026-11-25'
const demo = buildDemo(today)
const mine = { ...demo, records: demo.records.slice(0, 5).map((r) => ({ ...r, demo: undefined })), costs: [], clients: demo.clients.map((c) => ({ ...c, demo: undefined })) }
const backup = makeBackup({ ...demo, records: demo.records.slice(0, 2).map((r) => ({ ...r, demo: undefined })) }, { ...JSON.parse('{}'), features: {} } as never)

function setup(store: KeyValueStore) {
  const wrapper = ({ children }: { children: ReactNode }) => <InflowProvider store={store} today={today}>{children}</InflowProvider>
  return renderHook(() => useInflow(), { wrapper })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, workspace: 'mine', demoSeeded: true }))
})
afterEach(cleanup)

describe('restore (audit B-07)', () => {
  it('replaces the data, keeps what was there, and Undo brings it back', async () => {
    const store = memoryStore({ [DATA_KEY]: mine })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.load).toBe('ready'))
    expect(result.current.data.records).toHaveLength(5)

    let ok = false
    await act(async () => { ok = await result.current.restore(backup) })
    expect(ok).toBe(true)
    expect(result.current.data.records).toHaveLength(2)
    expect(((await store.get(PRE_RESTORE_KEY)) as { records: unknown[] }).records).toHaveLength(5)

    const toast = result.current.toasts.toasts.find((t) => t.actionLabel === 'Undo')!
    await act(async () => { toast.onAction!(); await new Promise((r) => setTimeout(r, 0)) })
    await waitFor(() => expect(result.current.data.records).toHaveLength(5))
    expect(((await store.get(DATA_KEY)) as { records: unknown[] }).records).toHaveLength(5)
  })

  it('a failed write leaves the current data untouched and says so', async () => {
    const inner = memoryStore({ [DATA_KEY]: mine })
    let refuse = false
    const store: KeyValueStore = { ...inner, set: async (k, v) => { if (refuse && k === DATA_KEY) throw new Error('disk full'); return inner.set(k, v) } }
    const { result } = setup(store)
    await waitFor(() => expect(result.current.load).toBe('ready'))
    refuse = true
    let ok = true
    await act(async () => { ok = await result.current.restore(backup) })
    expect(ok).toBe(false)
    expect(result.current.data.records).toHaveLength(5)
    expect(((await inner.get(DATA_KEY)) as { records: unknown[] }).records).toHaveLength(5)
    expect(result.current.toasts.toasts.some((t) => /Restoring failed: disk full/.test(String(t.message)))).toBe(true)
  })
})

describe('refunds through the provider', () => {
  it('refuses more than is left, and a deleted payment takes its refunds with it, Undo bringing both back', async () => {
    const store = memoryStore({ [DATA_KEY]: mine })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.load).toBe('ready'))
    const p = result.current.data.records.find((r) => r.status === 'received')!
    const f = { id: '', paymentId: p.id, date: p.date, amount: p.amount, currency: p.currency, fxRate: p.fxRate, amountRon: p.amountRon, notes: '' }
    await act(async () => { await result.current.saveRefund({ ...f, amount: p.amount + 1 }) })
    expect(result.current.data.refunds).toHaveLength(0)
    await act(async () => { await result.current.saveRefund(f) })
    expect(result.current.data.refunds).toHaveLength(1)
    expect(result.current.books.records.filter((r) => r.refundOf === p.id)).toHaveLength(1)

    await act(async () => { await result.current.deleteRecord(p) })
    expect(result.current.data.refunds).toHaveLength(0)
    const toast = result.current.toasts.toasts.find((t) => /refund deleted/.test(t.message))!
    await act(async () => { toast.onAction!(); await new Promise((r) => setTimeout(r, 0)) })
    await waitFor(() => expect(result.current.data.refunds).toHaveLength(1))
    expect(result.current.data.records.some((r) => r.id === p.id)).toBe(true)
  })
})

describe('a venue’s deal changing (venue history)', () => {
  it('pins payments saved before snapshots to the deal they were counted under, then saves the venue', async () => {
    const venue = { ...demo.venues.find((v) => v.deal === 'fixed')!, demo: undefined }
    const legacy = { ...mine, schema: 2, venues: [venue], records: mine.records.map((r) => ({ ...r, venueId: venue.id, dealTerms: undefined })) }
    const store = memoryStore({ [DATA_KEY]: legacy })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.load).toBe('ready'))
    await act(async () => { await result.current.saveEntity('venue', { ...venue, feePerSession: venue.feePerSession + 200 }) })
    const stored = (await store.get(DATA_KEY)) as InflowData
    expect(stored.records.every((r) => r.dealTerms?.feePerSession === venue.feePerSession)).toBe(true)
    expect(stored.venues[0].feePerSession).toBe(venue.feePerSession + 200)
  })
})

describe('Notion offline, then back (audit B-09)', () => {
  it('opens on the offline copy and loads Notion again when the connection returns', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, workspace: 'mine', demoSeeded: true, mode: 'notion', notionToken: 'ntn_x', incomeDbId: 'abc' }))
    const cached = { ...mine, records: mine.records.slice(0, 2) }
    const store = memoryStore({ [CACHE_KEY]: cached })
    let online = false
    const repo = new NotionRepo('t', 'abc', store, async () => { if (!online) throw new TypeError('Failed to fetch'); throw new Error('stop here') })
    const load = vi.spyOn(repo, 'load').mockImplementation(async () => { if (!online) throw new TypeError('Failed to fetch'); return mine })
    const wrapper = ({ children }: { children: ReactNode }) => <InflowProvider store={store} today={today} notionRepo={repo}>{children}</InflowProvider>
    const { result } = renderHook(() => useInflow(), { wrapper })
    await waitFor(() => expect(result.current.offlineCopy).toBe(true))
    expect(result.current.data.records).toHaveLength(2)
    online = true
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(result.current.offlineCopy).toBe(false))
    expect(result.current.data.records).toHaveLength(5)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
