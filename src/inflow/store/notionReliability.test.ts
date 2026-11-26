/**
 * Notion as a primary path (audit A-03, B-09), against an in-memory Notion that pages its
 * results, turns requests away with 429 and drops connections. Time is simulated, so the
 * relay's limit and the backoff are checked without waiting for them.
 *
 * Not run against live Notion here: see INFLOW.md, "Notion reliability", for what that leaves.
 */
import { describe, expect, it } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { buildDemo } from '../data/demo'
import type { InflowData } from '../domain/types'
import { earned, received, recovered, summarise } from '../lib/analytics'
import { earnings } from '../lib/earnings'
import { buildPnl, monthColumns } from '../lib/finance'
import { withRefunds } from '../lib/refunds'
import { CACHE_KEY, copyToNotion, memoryCopyLog, NotionRepo } from './notion'
import { paced, retryable, withRetry, type Call } from './notionCall'

/** A clock the code under test can only move by sleeping. */
function fakeTime() {
  let t = 0
  return { now: () => t, sleep: async (ms: number) => { t += ms }, get t() { return t } }
}

const status = (n: number, retryAfter?: number) => Object.assign(new Error(`HTTP ${n}`), { status: n, ...(retryAfter ? { retryAfter } : {}) })

const INCOME_SCHEMA = {
  Description: {}, Amount: {}, Currency: {}, 'FX rate': {}, 'Amount RON': {}, Date: {}, Status: {}, Category: {}, Recurring: {}, Notes: {}, Attendees: {},
  Sessions: {}, Hours: {}, Taxability: {}, 'Tax handling': {}, VAT: {}, Classification: {}, 'Tax reserve RON': {}, 'Reserve source': {}, 'Tax withheld RON': {},
  'Tax rules': {}, 'Venue terms': {}, 'Refund of': {}, 'Repays cost': {},
  Client: { relation: { database_id: 'clients' } }, Source: { relation: { database_id: 'sources' } }, Venue: { relation: { database_id: 'venues' } },
}

/** Turns written properties into what Notion returns on read. */
function asRead(props: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v.title) out[k] = { title: v.title.map((x: any) => ({ plain_text: x.text.content })) }
    else if (v.rich_text) out[k] = { rich_text: v.rich_text.map((x: any) => ({ plain_text: x.text.content })) }
    else if (v.relation) out[k] = { relation: v.relation.map((r: any) => ({ id: r.id })) }
    else out[k] = v
  }
  return out
}

/** Enough of Notion for InFlow: five databases on one page, paged queries, pages created and archived. */
function fakeNotion(opts: { every429?: number; dropCreateAt?: number; failAt?: number } = {}) {
  const dbs: Record<string, Map<string, Record<string, any>>> = { income: new Map(), clients: new Map(), sources: new Map(), venues: new Map(), costs: new Map() }
  let n = 0
  let calls = 0
  let inFlight = 0
  let maxInFlight = 0
  const call: Call = async (path, method, body: any) => {
    calls++
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    try {
      await Promise.resolve()
      if (opts.every429 && calls % opts.every429 === 0) throw status(429, 1)
      if (opts.failAt && calls === opts.failAt) throw new Error('Notion is down for good')
      if (path === 'databases/income' && method === 'GET') return { properties: INCOME_SCHEMA, parent: { type: 'page_id', page_id: 'page' } }
      // The other databases' schemas aren't modelled: an empty schema means every column is sent.
      if (path.startsWith('databases/') && method === 'GET') return { properties: {} }
      if (path.startsWith('databases/') && method === 'PATCH') return {}
      if (path.startsWith('blocks/page/children')) return { results: [{ type: 'child_database', id: 'costs', child_database: { title: 'InFlow — Costs' } }], has_more: false }
      const q = path.match(/^databases\/(\w+)\/query$/)
      if (q) {
        const all = [...dbs[q[1]].entries()].filter(([, p]) => !p.archived)
        const from = Number(body?.start_cursor ?? 0)
        const page = all.slice(from, from + 100).map(([id, p]) => ({ id, properties: asRead(p.properties) }))
        return { results: page, has_more: from + 100 < all.length, next_cursor: String(from + 100) }
      }
      if (path === 'pages' && method === 'POST') {
        const id = `pg${++n}`
        dbs[body.parent.database_id].set(id, { properties: body.properties })
        // The page is made, then the connection drops before the answer comes back.
        if (opts.dropCreateAt && n === opts.dropCreateAt) throw new TypeError('Failed to fetch')
        return { id }
      }
      const pg = path.match(/^pages\/(\w+)$/)
      if (pg && method === 'PATCH') {
        for (const db of Object.values(dbs)) {
          const p = db.get(pg[1])
          if (p) { if (body.archived) p.archived = true; else Object.assign(p.properties, body.properties); return { id: pg[1] } }
        }
        throw status(404)
      }
      throw new Error(`unexpected ${method} ${path}`)
    } finally {
      inFlight--
    }
  }
  return { call, dbs, get calls() { return calls }, get maxInFlight() { return maxInFlight }, rows: (db: string) => [...dbs[db].values()].filter((p) => !p.archived).length }
}

describe('retry and pacing (notionCall.ts)', () => {
  it('waits and tries again on 429, longer each time, and honours Retry-After', async () => {
    const time = fakeTime()
    let i = 0
    const waits: number[] = []
    const call = withRetry(async () => { if (++i < 4) throw status(429, i === 3 ? 7 : undefined); return { ok: true } },
      { sleep: async (ms) => { waits.push(ms); await time.sleep(ms) } })
    expect(await call('databases/x/query', 'POST')).toEqual({ ok: true })
    expect(waits).toHaveLength(3)
    expect(waits[1]).toBeGreaterThan(waits[0])
    expect(waits[2]).toBe(7000)
  })

  it('gives up after its tries, and never retries a real answer', async () => {
    const time = fakeTime()
    let i = 0
    const busy = withRetry(async () => { i++; throw status(503) }, { sleep: time.sleep, attempts: 4 })
    await expect(busy('pages/p', 'PATCH')).rejects.toThrow('HTTP 503')
    expect(i).toBe(4)
    i = 0
    const wrong = withRetry(async () => { i++; throw status(400) }, { sleep: time.sleep })
    await expect(wrong('pages/p', 'PATCH')).rejects.toThrow('HTTP 400')
    expect(i).toBe(1)
  })

  it('creates a page again only when Notion turned it away (429), never after a 5xx or a dropped connection', () => {
    expect(retryable(status(429), 'pages', 'POST')).toBe(true)
    expect(retryable(status(502), 'pages', 'POST')).toBe(false)
    expect(retryable(new TypeError('Failed to fetch'), 'pages', 'POST')).toBe(false)
    expect(retryable(new TypeError('Failed to fetch'), 'pages/p', 'PATCH')).toBe(true)
    expect(retryable(status(502), 'databases/x/query', 'POST')).toBe(true)
    expect(retryable(new Error('no access'), 'databases/x', 'PATCH')).toBe(false)
  })

  it('never starts more than the relay allows in ten seconds', async () => {
    const time = fakeTime()
    const starts: number[] = []
    const call = paced(async () => { starts.push(time.now()); return {} }, { now: time.now, sleep: time.sleep, limit: 18, windowMs: 10_000 })
    await Promise.all(Array.from({ length: 60 }, (_, k) => call(`pages/${k}`, 'GET')))
    expect(starts).toHaveLength(60)
    for (let k = 18; k < starts.length; k++) expect(starts[k] - starts[k - 18]).toBeGreaterThanOrEqual(10_000)
  })
})

// ── the repo against the fake ───────────────────────────────────────────────
const demo = buildDemo('2026-11-25')
const strip = <T extends { demo?: boolean }>(xs: T[]) => xs.map((x) => ({ ...x, demo: undefined }))
const mine: InflowData = {
  records: strip(demo.records), costs: strip(demo.costs), clients: strip(demo.clients), sources: strip(demo.sources), venues: strip(demo.venues), refunds: [],
}
const paidBack = mine.records.find((r) => r.status === 'received' && r.category !== 'reimbursement' && r.date.startsWith('2026-03'))!
mine.refunds = [{ id: 'loc_f1', paymentId: paidBack.id, date: '2026-04-02', amount: 50, currency: paidBack.currency, fxRate: paidBack.fxRate, amountRon: Math.round(50 * paidBack.fxRate * 100) / 100, notes: '' }]
const rows = mine.records.length + mine.costs.length + mine.refunds.length

function repoOn(f: ReturnType<typeof fakeNotion>, cache = memoryStore()) {
  const time = fakeTime()
  return { repo: new NotionRepo('t', 'income', cache, f.call, { now: time.now, sleep: time.sleep }), time, cache }
}

describe('copying to Notion: resumable, never twice (audit A-03)', () => {
  it('rides out 429s on its own and copies everything once', async () => {
    const f = fakeNotion({ every429: 7 })
    const { repo } = repoOn(f)
    const r = await copyToNotion(repo, mine)
    expect(r.copied).toBeGreaterThanOrEqual(rows)
    expect(f.rows('income')).toBe(mine.records.length + mine.refunds.length)
    expect(f.rows('costs')).toBe(mine.costs.length)
  })

  it('stopped partway, a second run carries on from there and makes no duplicate', async () => {
    const f = fakeNotion({ failAt: 120 })
    const log = memoryCopyLog()
    const { repo } = repoOn(f)
    await expect(copyToNotion(repo, mine, undefined, log)).rejects.toThrow('down for good')
    const before = f.rows('income') + f.rows('costs')
    expect(before).toBeGreaterThan(0)
    expect(before).toBeLessThan(rows)
    const again = await copyToNotion(repo, mine, undefined, log)
    expect(f.rows('income')).toBe(mine.records.length + mine.refunds.length)
    expect(f.rows('costs')).toBe(mine.costs.length)
    expect(again.skipped).toBeGreaterThan(0)
    // And once more: nothing to do.
    expect((await copyToNotion(repo, mine, undefined, log)).copied).toBe(0)
    expect(f.rows('income')).toBe(mine.records.length + mine.refunds.length)
  })

  it('a create whose answer was lost is not sent again by the retry (the page exists); the copy stops and says so', async () => {
    const f = fakeNotion({ dropCreateAt: 5 })
    const { repo } = repoOn(f)
    await expect(copyToNotion(repo, mine)).rejects.toThrow('Failed to fetch')
    expect(f.rows('clients') + f.rows('sources') + f.rows('venues')).toBe(5)
  })
})

describe('loading and the offline copy', () => {
  it('loads one database after another, every page of each, in order', async () => {
    const f = fakeNotion()
    const { repo } = repoOn(f)
    await copyToNotion(repo, mine)
    const fresh = repoOn(f).repo
    const d = await fresh.load()
    expect(d.records).toHaveLength(mine.records.length)
    expect(d.refunds).toHaveLength(1)
    expect(d.costs).toHaveLength(mine.costs.length)
    expect(f.maxInFlight).toBe(1)
  })

  it('keeps the offline copy current after every write (audit B-09)', async () => {
    const f = fakeNotion()
    const { repo, cache } = repoOn(f)
    await copyToNotion(repo, { ...mine, records: mine.records.slice(0, 3), costs: [], refunds: [] })
    await repo.load()
    const saved = await repo.saveRecord({ ...mine.records[5], id: '', clientId: null, sourceId: null, venueId: null })
    expect(((await cache.get(CACHE_KEY)) as InflowData).records.some((r) => r.id === saved.id)).toBe(true)
    await repo.deleteRecord(saved.id)
    expect(((await cache.get(CACHE_KEY)) as InflowData).records.some((r) => r.id === saved.id)).toBe(false)
    expect((await repo.cached()).records).toHaveLength(3)
  })
})

describe('the same numbers from Notion as from the device (parity)', () => {
  it('summary, P&L and Clients & work agree after a round trip through Notion', async () => {
    const f = fakeNotion()
    const { repo } = repoOn(f)
    await copyToNotion(repo, mine)
    const back = await repoOn(f).repo.load()
    const range = { from: '2026-01-01', to: '2026-12-31' }
    const figures = (d: InflowData) => {
      const books = withRefunds(d)
      const all = received(books.records, range)
      const s = summarise(earned(all), recovered(all))
      const pnl = buildPnl(books.records, books.costs, monthColumns(range))
      const e = earnings(books, range, 'client', { deals: true, costs: true }).totals
      return { total: s.total, recovery: s.costRecovery, cash: s.cashIn, reserve: s.reserve, net: pnl.lines.find((l) => l.key === 'net')!.total, kept: e.kept }
    }
    const a = figures(mine)
    const b = figures(back)
    for (const k of Object.keys(a) as (keyof typeof a)[]) expect(b[k]).toBeCloseTo(a[k], 1)
  })
})

describe('a reimbursement’s link to its cost survives the copy to Notion', () => {
  it('points at the cost’s Notion page, and reads back', async () => {
    const c = mine.costs.find((x) => x.status === 'paid')!
    const r = { ...mine.records.find((x) => x.status === 'received')!, id: 'loc_re', category: 'reimbursement' as const, repaysCostId: c.id, clientId: null, sourceId: null, venueId: null }
    const f = fakeNotion()
    const { repo } = repoOn(f)
    await copyToNotion(repo, { ...mine, records: [r], costs: [c], refunds: [] })
    const back = await repoOn(f).repo.load()
    expect(back.records[0].repaysCostId).toBe(back.costs[0].id)
  })
})
