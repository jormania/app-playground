// @vitest-environment jsdom
/**
 * Saving and undoing an import through the provider, as the Import screen does (Release 2,
 * experimental): on this device, with a save that fails part way, and against a store a
 * backup restores.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { memoryStore, type KeyValueStore } from '../../shared/kvStore'
import { DEMO_SETTINGS_TAX } from '../data/demo'
import type { Client, IncomeRecord, InflowData } from '../domain/types'
import { classify, effective, expandFees, type Choice, type Row } from '../lib/import/classify'
import { parseCsv } from '../lib/import/csv'
import { buildPlan } from '../lib/import/plan'
import { readStatement } from '../lib/import/revolut'
import { makeBackup, readBackup } from '../store/backup'
import { importKey, loadImports } from '../store/imports'
import { DATA_KEY, DeviceRepo } from '../store/repo'
import { ALL_FEATURES, SETTINGS_KEY } from '../store/settings'
import { useImports } from './import'
import { InflowProvider, useInflow } from './state'

const today = '2026-11-25'
const client = (id: string, name: string): Client => ({ id, name, kind: 'business', country: 'RO', contact: '', notes: '', archived: false })
const pay = (p: Partial<IncomeRecord> & { id: string; amount: number; date: string }): IncomeRecord => ({
  description: 'Workshop', currency: 'RON', fxRate: 1, amountRon: p.amount, status: 'received', clientId: null, sourceId: null, venueId: null,
  category: 'workshop', recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared',
  vat: 'exempt', classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '', ...p,
})

const CSV = [
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
  'TRANSFER,Current,2026-03-02 09:15:01,2026-03-02 09:15:44,Payment from Acme SRL,1200.00,0.00,RON,COMPLETED,5200.00',
  'TRANSFER,Current,2026-03-03 10:00:00,2026-03-03 10:00:05,Payment from Ana Popescu,450.00,0.00,RON,COMPLETED,5650.00',
  'CARD_PAYMENT,Current,2026-03-04 12:00:00,2026-03-05 08:00:00,"Zoom, Inc.",-75.50,0.00,RON,COMPLETED,5574.50',
  'TRANSFER,Current,2026-03-07 10:00:00,2026-03-07 10:00:10,To Sala Lumina,-400.00,2.00,RON,COMPLETED,5172.50',
  'EXCHANGE,Current,2026-03-08 10:00:00,2026-03-08 10:00:00,Exchanged to EUR,-500.00,0.00,RON,COMPLETED,4672.50',
  'TRANSFER,Current,2026-03-09 11:00:00,2026-03-09 11:00:02,Payment from Beta Corp,600.00,0.00,RON,COMPLETED,5272.50',
].join('\n')

const start = (): InflowData => ({
  clients: [client('acme', 'Acme SRL'), client('ana', 'Ana Popescu'), client('beta', 'Beta Corp')], sources: [], venues: [], costs: [], refunds: [],
  records: [
    pay({ id: 'loc_ana', amount: 450, date: '2026-03-03', clientId: 'ana' }),             // entered by hand: will be linked
    pay({ id: 'loc_beta', amount: 1000, date: '2026-03-20', clientId: 'beta', status: 'expected' }), // 600 arrives: part
  ],
})

function setup(store: KeyValueStore) {
  const wrapper = ({ children }: { children: ReactNode }) => <InflowProvider store={store} today={today}>{children}</InflowProvider>
  return renderHook(() => ({ app: useInflow(), im: useImports() }), { wrapper })
}

/** What the Import screen does on Import: classify, apply the person's choices, plan, run. */
async function runImport(h: ReturnType<typeof setup>['result'], over: (r: Row) => Partial<Choice> | undefined = (r) => (r.tx.direction === 'out' && r.suggestion.kind === 'review' ? { kind: 'cost' } : undefined)) {
  const { app, im } = h.current
  const rows = classify(expandFees(readStatement(parseCsv(CSV)).txs), { data: app.data, rules: im.state.rules, ledger: im.state.ledger, ownNames: im.state.ownNames })
  const batch = `imp_${Math.random().toString(36).slice(2, 8)}`
  const plan = buildPlan({ rows, choices: new Map(rows.map((r) => [r.tx.key, effective(r, over(r))])), data: app.data, features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch })
  let res!: Awaited<ReturnType<typeof im.run>>
  await act(async () => { res = await h.current.im.run(plan.ops, { name: 'statement.csv', rows: 6, from: '2026-03-02', to: '2026-03-09', currencies: ['RON'] }, batch, []) })
  return { rows, plan, res }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } }))
})
afterEach(cleanup)

describe('an import on this device', () => {
  it('adds, links and receives; the same file again finds everything in; undo puts it all back', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await waitFor(() => expect(result.current.im.ready).toBe(true))
    const { plan, res } = await runImport(result)
    expect(plan.counts).toMatchObject({ records: 1, costs: 3, linked: 1, received: 1, setAside: 1 })
    expect(res.failedAt).toBeNull()

    const d = (await store.get(DATA_KEY)) as InflowData
    // Acme new; Ana's own entry kept as it was, now marked; Beta 600 received, 400 still expected.
    expect(d.records.find((r) => r.clientId === 'acme')).toMatchObject({ amount: 1200, sessions: 0, taxWithheld: 0, importMeta: { counterparty: 'Acme SRL' } })
    expect(d.records.find((r) => r.id === 'loc_ana')).toMatchObject({ amount: 450, description: 'Workshop', sessions: 1, importMeta: { matched: true } })
    expect(d.records.filter((r) => r.clientId === 'beta').map((r) => [r.status, r.amount]).sort()).toEqual([['expected', 400], ['received', 600]])
    expect(d.costs.map((c) => c.amount).sort((a, b) => a - b)).toEqual([2, 75.5, 400])

    const s = await loadImports(store, importKey('device'))
    expect(s.batches[0]).toMatchObject({ status: 'done', setAside: 1 })
    expect(Object.values(s.ledger).map((e) => e.outcome).sort()).toEqual(['created', 'created', 'created', 'created', 'linked', 'received', 'skipped'])

    // The same file again: nothing new.
    await waitFor(() => expect(result.current.im.state.batches).toHaveLength(1))
    const again = classify(expandFees(readStatement(parseCsv(CSV)).txs), { data: result.current.app.data, rules: [], ledger: result.current.im.state.ledger, ownNames: [] })
    expect(again.filter((r) => r.match.status !== 'exact' && r.suggestion.action !== 'skip')).toEqual([])

    // Edit one imported cost, then undo: it goes too (the confirmation said so); your entry stays.
    const zoom = result.current.app.data.costs.find((c) => c.amount === 75.5)!
    await act(async () => { await result.current.app.saveCost({ ...zoom, notes: 'annual plan' }) })
    await act(async () => { await result.current.im.undo(result.current.im.state.batches[0]) })
    const after = (await store.get(DATA_KEY)) as InflowData
    expect(after.costs).toEqual([])
    expect(after.records.map((r) => [r.id, r.status, r.amount, r.importMeta ?? null]).sort()).toEqual([
      ['loc_ana', 'received', 450, null], ['loc_beta', 'expected', 1000, null],
    ])
    const s2 = await loadImports(store, importKey('device'))
    expect(s2.ledger).toEqual({})
    expect(s2.batches[0].status).toBe('undone')
  })

  it('undo keeps an imported payment that a refund added since depends on, and says why', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    const acme = result.current.app.data.records.find((r) => r.clientId === 'acme')!
    await act(async () => { await result.current.app.saveRefund({ id: '', paymentId: acme.id, date: '2026-04-01', amount: 100, currency: 'RON', fxRate: 1, amountRon: 100, notes: '' }) })
    const { previewUndo } = await import('./import')
    const p = previewUndo(result.current.im.state.batches[0], result.current.app.data)
    expect(p.keep).toEqual([expect.objectContaining({ id: acme.id, why: expect.stringMatching(/refund/) })])
    await act(async () => { await result.current.im.undo(result.current.im.state.batches[0]) })
    const after = (await store.get(DATA_KEY)) as InflowData
    expect(after.records.find((r) => r.id === acme.id)).toBeTruthy()
    expect(after.refunds).toHaveLength(1)
  })

  it('stopped part way by a failed save: the same file again carries on, and nothing is made twice', async () => {
    const inner = memoryStore({ [DATA_KEY]: start() })
    let writes = 0
    let failOn = 3
    // The third data write fails once (a full disk, a closed tab): the import stops there.
    const store: KeyValueStore = { ...inner, update: async (k, fn) => { if (k === DATA_KEY && ++writes === failOn) throw new Error('disk full'); return inner.update(k, fn) } }
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    const first = await runImport(result)
    expect(first.res.failedAt).not.toBeNull()
    failOn = -1
    await waitFor(() => expect(result.current.im.state.batches).toHaveLength(1))
    const second = await runImport(result)
    expect(second.res.failedAt).toBeNull()
    const d = (await inner.get(DATA_KEY)) as InflowData
    expect(d.records.filter((r) => r.clientId === 'acme')).toHaveLength(1)
    expect(d.costs.map((c) => c.amount).sort((a, b) => a - b)).toEqual([2, 75.5, 400])
    expect(d.records.filter((r) => r.clientId === 'beta').map((r) => r.amount).sort()).toEqual([400, 600])
  })

  it('a backup carries the import history; restoring it brings the rules and ledger back', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    await act(async () => { await result.current.im.saveRule({ id: 'r1', match: 'counterparty', value: 'Zoom, Inc.', direction: 'out', kind: 'cost', costCategory: 'software', created: today }) })
    const imports = await loadImports(store, importKey('device'))
    const file = JSON.stringify(makeBackup(result.current.app.data, result.current.app.settings, new Date(), imports))
    const b = readBackup(file)
    expect(b.imports?.rules).toHaveLength(1)
    const other = memoryStore()
    const two = setup(other)
    await waitFor(() => expect(two.result.current.app.load).toBe('ready'))
    await act(async () => { await two.result.current.app.restore(b) })
    const back = await loadImports(other, importKey('device'))
    expect(back.rules.map((r) => r.value)).toEqual(['Zoom, Inc.'])
    expect(Object.keys(back.ledger)).toHaveLength(7)
    // An older backup (no imports) leaves import history alone, and a damaged one is read as far as it goes.
    expect(readBackup(JSON.stringify(makeBackup(start(), result.current.app.settings))).imports).toBeUndefined()
    expect(readBackup(JSON.stringify({ ...JSON.parse(file), imports: { rules: 'x', ledger: [] } })).imports).toMatchObject({ rules: [], ledger: {}, batches: [] })
  })

  it('import history belongs to its data: the demo has its own', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    expect(result.current.app.importStore.key).toBe('import:device')
    act(() => result.current.app.setWorkspace('demo'))
    await waitFor(() => expect(result.current.app.importStore.key).toBe('import:demo'))
    expect(new DeviceRepo(store)).toBeTruthy()
  })
})
