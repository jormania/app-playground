// @vitest-environment jsdom
/**
 * Adversarial audit of saving and undoing an import (see lib/import/audit.test.ts for the parser
 * side). Ids (E-nn) match the audit report. Expected values were written from the inputs by hand.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { memoryStore, type KeyValueStore } from '../../shared/kvStore'
import { DEMO_SETTINGS_TAX } from '../data/demo'
import type { Client, IncomeRecord, InflowData } from '../domain/types'
import { classify, effective, expandFees, type Choice, type Row } from '../lib/import/classify'
import { parseCsv } from '../lib/import/csv'
import { buildPlan, planSignature } from '../lib/import/plan'
import { readStatement } from '../lib/import/revolut'
import { importKey, loadImports } from '../store/imports'
import { DATA_KEY, type Repo } from '../store/repo'
import { ALL_FEATURES, SETTINGS_KEY } from '../store/settings'
import { ImportBusy, previewUndo, useImports } from './import'
import { InflowProvider, useInflow } from './state'

const today = '2026-11-25'
const client = (id: string, name: string): Client => ({ id, name, kind: 'business', country: 'RO', contact: '', notes: '', archived: false })
const pay = (p: Partial<IncomeRecord> & { id: string; amount: number; date: string }): IncomeRecord => ({
  description: 'Workshop', currency: 'RON', fxRate: 1, amountRon: p.amount, status: 'received', clientId: null, sourceId: null, venueId: null,
  category: 'workshop', recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared',
  vat: 'exempt', classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '', ...p,
})

const HEAD = 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance'
const ROWS = [
  'TRANSFER,Current,2026-03-02 09:15:01,2026-03-02 09:15:44,Payment from Acme SRL,1200.00,0.00,RON,COMPLETED,5200.00',
  'TRANSFER,Current,2026-03-03 10:00:00,2026-03-03 10:00:05,Payment from Ana Popescu,450.00,0.00,RON,COMPLETED,5650.00',
  'CARD_PAYMENT,Current,2026-03-04 12:00:00,2026-03-05 08:00:00,"Zoom, Inc.",-75.50,0.00,RON,COMPLETED,5574.50',
  'TRANSFER,Current,2026-03-07 10:00:00,2026-03-07 10:00:10,To Sala Lumina,-400.00,2.00,RON,COMPLETED,5172.50',
  'TRANSFER,Current,2026-03-09 11:00:00,2026-03-09 11:00:02,Payment from Beta Corp,600.00,0.00,RON,COMPLETED,5772.50',
]
const CSV = [HEAD, ...ROWS].join('\n')
const start = (): InflowData => ({
  clients: [client('acme', 'Acme SRL'), client('ana', 'Ana Popescu'), client('beta', 'Beta Corp')], sources: [], venues: [], costs: [], refunds: [],
  records: [
    pay({ id: 'loc_ana', amount: 450, date: '2026-03-03', clientId: 'ana', notes: 'paid in cash first' }),
    pay({ id: 'loc_beta', amount: 1000, date: '2026-03-20', clientId: 'beta', status: 'expected' }),
  ],
})
const decideAll = (r: Row): Partial<Choice> => ({ ...(r.tx.direction === 'out' && r.suggestion.kind === 'review' ? { kind: 'cost' as const } : {}), confirmed: true })

function setup(store: KeyValueStore, notionRepo?: Repo) {
  const wrapper = ({ children }: { children: ReactNode }) => <InflowProvider store={store} today={today} notionRepo={notionRepo}>{children}</InflowProvider>
  return renderHook(() => ({ app: useInflow(), im: useImports() }), { wrapper })
}
async function runImport(h: ReturnType<typeof setup>['result'], csv = CSV, extra: Partial<Choice> = {}) {
  const { app, im } = h.current
  const rows = classify(expandFees(readStatement(parseCsv(csv), { timeZone: 'local' }).txs), { data: app.data, rules: im.state.rules, ledger: im.state.ledger, ownNames: [] })
  const batch = `imp_${Math.random().toString(36).slice(2, 8)}`
  const plan = buildPlan({ rows, choices: new Map(rows.map((r) => [r.tx.key, effective(r, { ...decideAll(r), ...extra })])), data: app.data, features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch })
  let res!: Awaited<ReturnType<typeof im.run>>
  await act(async () => { res = await h.current.im.run(plan.ops, { name: 's.csv', rows: rows.length, from: null, to: null, currencies: ['RON'] }, batch, []) })
  return { rows, plan, res }
}
const reread = (h: ReturnType<typeof setup>['result'], csv: string) =>
  classify(expandFees(readStatement(parseCsv(csv), { timeZone: 'local' }).txs), { data: h.current.app.data, rules: [], ledger: h.current.im.state.ledger, ownNames: [] })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } }))
})
afterEach(cleanup)

describe('E-01 re-importing: the same file, an overlapping part, another order', () => {
  it('creates nothing more; every row is found already in', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    const first = await runImport(result)
    // 5 rows + 1 fee: Acme new, Ana linked, Zoom and Sala costs, Sala's fee, Beta 600 of 1000 received.
    expect(first.plan.counts).toMatchObject({ records: 1, costs: 3, linked: 1, received: 1, waiting: 0 })
    const before = (await store.get(DATA_KEY)) as InflowData
    expect([before.records.length, before.costs.length]).toEqual([4, 3])
    for (const csv of [CSV, [HEAD, ROWS[3], ROWS[1]].join('\n'), [HEAD, ...[...ROWS].reverse()].join('\n')]) {
      const rows = reread(result, csv)
      expect(rows.every((r) => r.match.status === 'exact')).toBe(true)
      const p = buildPlan({ rows, choices: new Map(rows.map((r) => [r.tx.key, effective(r, decideAll(r))])), data: result.current.app.data, features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'again' })
      expect(p.ops).toEqual([])
    }
    const after = (await store.get(DATA_KEY)) as InflowData
    expect([after.records.length, after.costs.length]).toEqual([4, 3])
  })

  it('E-02 linking changes only the import mark of your entry', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    const d = (await store.get(DATA_KEY)) as InflowData
    const { importMeta, dealTerms: _d, ...rest } = d.records.find((r) => r.id === 'loc_ana')!
    const { dealTerms: _e, ...was } = start().records[0]
    expect(rest).toEqual(was)
    expect(importMeta).toMatchObject({ matched: true, counterparty: 'Ana Popescu' })
  })
})

describe('E-03 a Notion save whose answer is lost', () => {
  it('the retry finds the page Notion made and does not make a second', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, workspace: 'mine', demoSeeded: true, mode: 'notion', notionToken: 'ntn_x', incomeDbId: 'abc', features: { ...ALL_FEATURES, import: true } }))
    const pages: IncomeRecord[] = []
    let n = 0
    let dropNext = true
    const repo: Repo = {
      kind: 'notion',
      load: async () => ({ records: [...pages], costs: [], clients: [client('acme', 'Acme SRL')], sources: [], venues: [], refunds: [] }),
      // The page is made; the answer never arrives (a dropped connection).
      saveRecord: async (r) => { const saved = { ...r, id: r.id || `pg${++n}` }; pages.push(saved); if (dropNext) { dropNext = false; throw new TypeError('Failed to fetch') } return saved },
      deleteRecord: async () => {}, saveCost: async (c) => c, deleteCost: async () => {}, saveEntity: async (_k, e) => e, deleteEntity: async () => {},
      saveRefund: async (f) => f, deleteRefund: async () => {},
      findImported: async (_kind, key) => pages.find((p) => p.importMeta?.key === key)?.id ?? null,
    }
    const store = memoryStore()
    const { result } = setup(store, repo)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    const one = [HEAD, ROWS[0]].join('\n')
    const first = await runImport(result, one)
    expect(first.res.failedAt).not.toBeNull()
    expect(pages).toHaveLength(1)
    const ledger = (await loadImports(store, importKey('notion:abc'))).ledger
    expect(Object.values(ledger).map((e) => e.outcome)).toEqual(['pending'])
    // The app never got the answer, so its data still lacks the page. Read again, the row is flagged:
    const again = reread(result, one)
    expect(again[0].match).toMatchObject({ status: 'possible', reason: expect.stringMatching(/was saving this transaction when it stopped/) })
    // and even if you say to import it anyway, the page Notion made is found and kept, not made twice.
    const second = await runImport(result, one, { anyway: true })
    expect(second.res.failedAt).toBeNull()
    expect(pages).toHaveLength(1)
    expect(second.res.batch.created).toEqual([expect.objectContaining({ id: 'pg1' })])
  })
})

describe('E-04 one import at a time', () => {
  it('a second tab is turned away while the first holds the lock', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    await store.set(`${importKey('device')}:lock`, { tab: 'tab_other', at: Date.now() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await expect(act(async () => { await result.current.im.run([], { name: 'x', rows: 0, from: null, to: null, currencies: [] }, 'b', []) })).rejects.toBeInstanceOf(ImportBusy)
    // A lock left by a tab that closed long ago is taken over.
    await store.set(`${importKey('device')}:lock`, { tab: 'tab_other', at: Date.now() - 10 * 60_000 })
    await act(async () => { await result.current.im.run([], { name: 'x', rows: 0, from: null, to: null, currencies: [] }, 'b2', []) })
    expect(await store.get(`${importKey('device')}:lock`)).toBeNull()
  })
})

describe('E-05..E-07 undo', () => {
  it('E-05 an undo that fails part way says so, keeps the batch undoable, and a second undo finishes', async () => {
    const inner = memoryStore({ [DATA_KEY]: start() })
    let refuse = false
    const store: KeyValueStore = { ...inner, update: async (k, fn) => { if (refuse && k === DATA_KEY) throw new Error('disk full'); return inner.update(k, fn) } }
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    refuse = true
    let r1!: { failed: number }
    await act(async () => { r1 = await result.current.im.undo(result.current.im.state.batches[0]) })
    expect(r1.failed).toBeGreaterThan(0)
    const s1 = await loadImports(inner, importKey('device'))
    expect([s1.batches[0].status, s1.batches[0].undoFailed]).toEqual(['done', r1.failed])
    expect(Object.keys(s1.ledger).length).toBeGreaterThan(0)
    refuse = false
    let r2!: { failed: number }
    await act(async () => { r2 = await result.current.im.undo((await loadImports(inner, importKey('device'))).batches[0]) })
    expect(r2.failed).toBe(0)
    const d = (await inner.get(DATA_KEY)) as InflowData
    expect(d.records.map((r) => [r.id, r.status, r.amount, r.importMeta ?? null]).sort()).toEqual([['loc_ana', 'received', 450, null], ['loc_beta', 'expected', 1000, null]])
    expect(d.costs).toEqual([])
    expect((await loadImports(inner, importKey('device'))).batches[0].status).toBe('undone')
  })

  it('E-06 a balance still expected that you changed after the import is left as you made it', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    const rest = result.current.app.data.records.find((r) => r.id === 'loc_beta')!
    expect([rest.status, rest.amount]).toEqual(['expected', 400])
    await act(async () => { await result.current.app.saveRecord({ ...rest, amount: 350, amountRon: 350 }) })
    const p = previewUndo(result.current.im.state.batches[0], result.current.app.data)
    expect(p.unreceive).toEqual([expect.objectContaining({ edited: true })])
    await act(async () => { await result.current.im.undo(result.current.im.state.batches[0]) })
    const d = (await store.get(DATA_KEY)) as InflowData
    // The received 600 stays (its expected balance was changed), and the 350 you set is kept.
    expect(d.records.filter((r) => r.clientId === 'beta').map((r) => [r.status, r.amount]).sort()).toEqual([['expected', 350], ['received', 600]])
  })

  it('E-07 undoing twice changes nothing the second time', async () => {
    const store = memoryStore({ [DATA_KEY]: start() })
    const { result } = setup(store)
    await waitFor(() => expect(result.current.app.load).toBe('ready'))
    await runImport(result)
    const batch = result.current.im.state.batches[0]
    await act(async () => { await result.current.im.undo(batch) })
    const once = await store.get(DATA_KEY)
    await act(async () => { await result.current.im.undo(batch) })
    expect(await store.get(DATA_KEY)).toEqual(once)
  })
})

describe('E-08 a plan reviewed on data that changed is never saved unseen', () => {
  it('deleting the entry a row links to changes the plan\'s signature', async () => {
    const data = start()
    const rows = classify(expandFees(readStatement(parseCsv(CSV), { timeZone: 'local' }).txs), { data, rules: [], ledger: {}, ownNames: [] })
    const choices = new Map(rows.map((r) => [r.tx.key, effective(r, decideAll(r))]))
    const plan = (d: InflowData) => buildPlan({ rows, choices, data: d, features: ALL_FEATURES, profile: DEMO_SETTINGS_TAX, rates: new Map(), batch: 'x' })
    expect(planSignature(plan(data))).toBe(planSignature(plan(structuredClone(data))))
    const changed = { ...data, records: data.records.filter((r) => r.id !== 'loc_ana') }
    expect(planSignature(plan(changed))).not.toBe(planSignature(plan(data)))
  })
})
