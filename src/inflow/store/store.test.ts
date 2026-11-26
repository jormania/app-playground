import { describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { buildDemo, withoutDemo } from '../data/demo'
import { DEFAULT_SETTINGS } from './settings'
import { BackupError, makeBackup, readBackup, recordsCsv, toCsv } from './backup'
import {
  clientFromPage, clientToProps, copyToNotion, costFromPage, costToProps, discoverDatabases, NotionRepo, recordFromPage, recordToProps,
  sourceFromPage, sourceToProps, venueFromPage, venueToProps, isRefundPage, refundFromPage, refundToProps, termsFromText, termsToText,
} from './notion'
import { DeviceRepo } from './repo'

const demo = buildDemo('2026-11-25')

/** Turn written properties into the shape Notion returns on read. */
function asRead(props: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v.title) out[k] = { title: v.title.map((t: any) => ({ plain_text: t.text.content })) }
    else if (v.rich_text) out[k] = { rich_text: v.rich_text.map((t: any) => ({ plain_text: t.text.content })) }
    else out[k] = v
  }
  return out
}

describe('Notion mapping', () => {
  it('round-trips every demo record through Notion properties', () => {
    for (const r of demo.records) {
      const back = recordFromPage({ id: r.id, properties: asRead(recordToProps(r)) })
      const { demo: _d, ...expected } = r
      expect(back).toEqual(expected)
    }
  })

  it('round-trips every demo cost through Notion properties', () => {
    expect(demo.costs.length).toBeGreaterThan(50)
    for (const c of demo.costs) {
      const { demo: _d, ...expected } = c
      expect(costFromPage({ id: c.id, properties: asRead(costToProps(c)) })).toEqual(expected)
    }
  })

  it('round-trips clients, sources and venues', () => {
    for (const c of demo.clients) expect(clientFromPage({ id: c.id, properties: asRead(clientToProps(c)) })).toEqual((({ demo: _, ...x }) => x)(c))
    for (const s of demo.sources) expect(sourceFromPage({ id: s.id, properties: asRead(sourceToProps(s)) })).toEqual((({ demo: _, ...x }) => x)(s))
    for (const v of demo.venues) expect(venueFromPage({ id: v.id, properties: asRead(venueToProps(v)) })).toEqual((({ demo: _, ...x }) => x)(v))
  })

  it('splits long notes at Notion\'s 2,000-character limit', () => {
    const long = 'x'.repeat(4500)
    const props = recordToProps({ ...demo.records[0], notes: long })
    expect(props['Notes'].rich_text.map((t: any) => t.text.content.length)).toEqual([2000, 2000, 500])
  })

  it('reads a sparse page without throwing, defaulting tax fields to "needs review"', () => {
    const r = recordFromPage({ id: 'abc', properties: { Description: { title: [] }, Date: { date: { start: '2026-01-02' } } } })
    expect(r).toMatchObject({ amount: 0, currency: 'RON', taxability: 'review', vat: 'undetermined', classification: 'suggested', date: '2026-01-02' })
  })
})

describe('discoverDatabases', () => {
  const incomeProps = {
    Description: { type: 'title' }, Amount: {}, Date: {}, Taxability: {},
    Client: { relation: { database_id: 'aaaa-1' } }, Source: { relation: { database_id: 'bbbb-2' } }, Venue: { relation: { database_id: 'cccc-3' } },
  }
  it('finds the three related databases from the Income link, and Costs beside it', async () => {
    const call = vi.fn(async (path: string) => path.startsWith('blocks/')
      ? { results: [{ type: 'child_database', id: 'aaaa-0', child_database: { title: 'InFlow — Clients' } }, { type: 'child_database', id: 'dddd-4', child_database: { title: 'InFlow — Costs' } }] }
      : { properties: incomeProps, parent: { type: 'page_id', page_id: 'page-1' } })
    const dbs = await discoverDatabases(call, 'https://www.notion.so/InFlow-Income-423d3e6d60db8153942bd13b8b6922b2?v=1')
    expect(call).toHaveBeenCalledWith('databases/423d3e6d60db8153942bd13b8b6922b2', 'GET')
    expect(call).toHaveBeenCalledWith('blocks/page1/children?page_size=100', 'GET')
    expect(dbs).toEqual({ income: '423d3e6d60db8153942bd13b8b6922b2', clients: 'aaaa1', sources: 'bbbb2', venues: 'cccc3', costs: 'dddd4' })
  })

  it('works without a Costs database, or without access to the page', async () => {
    const noPage = await discoverDatabases(async () => ({ properties: incomeProps }), 'x')
    expect(noPage.costs).toBeNull()
    const refused = await discoverDatabases(async (path: string) => {
      if (path.startsWith('blocks/')) throw new Error('Could not find block')
      return { properties: incomeProps, parent: { type: 'page_id', page_id: 'p' } }
    }, 'x')
    expect(refused.costs).toBeNull()
  })
  it('explains a wrong database rather than failing later', async () => {
    await expect(discoverDatabases(async () => ({ properties: { Name: {} } }), 'x')).rejects.toThrow(/InFlow — Income/)
  })
})

describe('NotionRepo', () => {
  it('creates in the right database and archives on delete', async () => {
    const calls: [string, string, any][] = []
    const call = async (path: string, method: string, body?: any) => {
      calls.push([path, method, body])
      if (path.startsWith('databases/') && method === 'GET') {
        return { properties: { Description: {}, Amount: {}, Date: {}, Taxability: {}, Client: { relation: { database_id: 'c1' } }, Source: { relation: { database_id: 's1' } }, Venue: { relation: { database_id: 'v1' } } } }
      }
      return { id: 'new-page-id' }
    }
    const repo = new NotionRepo('t', 'inc', memoryStore(), call)
    const saved = await repo.saveRecord({ ...demo.records[0], id: '', demo: undefined, clientId: null, sourceId: null, venueId: null })
    expect(saved.id).toBe('newpageid')
    expect(saved.demo).toBeUndefined()
    expect(calls.at(-1)?.[2].parent).toEqual({ database_id: 'inc' })
    await repo.saveEntity('venue', { ...demo.venues[0], id: '', demo: undefined })
    expect(calls.at(-1)?.[2].parent).toEqual({ database_id: 'v1' })
    await repo.deleteRecord('xyz')
    expect(calls.at(-1)).toEqual(['pages/xyz', 'PATCH', { archived: true }])
  })

  it('leaves out columns an older copy of the database lacks, instead of failing the save', async () => {
    const calls: [string, string, any][] = []
    const income = { Description: {}, Amount: {}, Date: {}, Taxability: {}, Client: { relation: { database_id: 'c1' } }, Source: { relation: { database_id: 's1' } }, Venue: { relation: { database_id: 'v1' } } }
    const call = async (path: string, method: string, body?: any) => {
      calls.push([path, method, body])
      return path.startsWith('databases/') && method === 'GET' ? { properties: income } : { id: 'p1' }
    }
    const repo = new NotionRepo('t', 'inc', memoryStore(), call)
    await repo.saveRecord({ ...demo.records[0], id: '', demo: undefined, clientId: null, sourceId: null, venueId: null })
    const sent = Object.keys(calls.at(-1)![2].properties)
    expect(sent).toContain('Amount')
    expect(sent).not.toContain('Sessions')
    expect(sent).not.toContain('Hours')
    // The venue-deal snapshot's column is added to the database (once), not left out.
    expect(calls.find(([p, m]) => p === 'databases/inc' && m === 'PATCH')?.[2]).toEqual({ properties: { 'Venue terms': { rich_text: {} } } })
    expect(sent.every((k) => k in income || k === 'Venue terms')).toBe(true)
  })

  it('copies device data to Notion with relations remapped, never demo rows', async () => {
    const mine = { ...demo, records: [{ ...demo.records[0], id: 'loc_1', demo: undefined }] }
    let n = 0
    const saved: any[] = []
    const repo = {
      kind: 'notion' as const,
      load: async () => mine,
      saveRecord: async (r: any) => { saved.push(r); return { ...r, id: `p${n++}` } },
      deleteRecord: async () => {},
      saveCost: async (c: any) => ({ ...c, id: `p${n++}` }),
      deleteCost: async () => {},
      saveEntity: async (_k: any, e: any) => ({ ...e, id: `p${n++}` }),
      deleteEntity: async () => {},
      saveRefund: async (f: any) => ({ ...f, id: `p${n++}` }),
      deleteRefund: async () => {},
    }
    const { copied } = await copyToNotion(repo, mine)
    expect(copied).toBeGreaterThanOrEqual(1)
    expect(saved).toHaveLength(1)
    expect(saved[0].clientId).toMatch(/^p\d+$/)
    expect(saved[0].clientId).not.toBe(mine.records[0].clientId)
  })
})

describe('two tabs on one device (audit A-01)', () => {
  it('each tab keeps the other\'s new records, though both loaded before either saved', async () => {
    const store = memoryStore()
    await new DeviceRepo(store).replaceAll({ ...demo, records: [] })
    const tabA = new DeviceRepo(store)
    const tabB = new DeviceRepo(store)
    await tabA.load()
    await tabB.load()
    const base = { ...demo.records[0], id: '', demo: undefined }
    await tabA.saveRecord({ ...base, description: 'from tab A', amount: 777, amountRon: 777 })
    await tabB.saveRecord({ ...base, description: 'from tab B', amount: 888, amountRon: 888 })
    await tabA.saveCost({ ...demo.costs[0], id: '', demo: undefined, description: 'cost from tab A' })
    const after = await new DeviceRepo(store).load()
    expect(after.records.map((r) => r.description).sort()).toEqual(['from tab A', 'from tab B'])
    expect(after.costs.some((c) => c.description === 'cost from tab A')).toBe(true)
  })

  it('a delete in one tab does not bring back a record the other tab deleted', async () => {
    const store = memoryStore()
    const seed = new DeviceRepo(store)
    await seed.replaceAll({ ...demo, records: demo.records.slice(0, 3) })
    const [x, y] = demo.records
    const tabA = new DeviceRepo(store); await tabA.load()
    const tabB = new DeviceRepo(store); await tabB.load()
    await tabA.deleteRecord(x.id)
    await tabB.deleteRecord(y.id)
    const ids = (await new DeviceRepo(store).load()).records.map((r) => r.id)
    expect(ids).not.toContain(x.id)
    expect(ids).not.toContain(y.id)
    expect(ids).toHaveLength(1)
  })
})

describe('DeviceRepo', () => {
  it('persists, updates and unlinks deleted entities without losing records', async () => {
    const store = memoryStore()
    const repo = new DeviceRepo(store)
    await repo.replaceAll(demo)
    const clientId = demo.records[0].clientId!
    await repo.deleteEntity('client', clientId)
    const again = await new DeviceRepo(store).load()
    expect(again.records).toHaveLength(demo.records.length)
    expect(again.records.some((r) => r.clientId === clientId)).toBe(false)
    const created = await repo.saveRecord({ ...demo.records[0], id: '' })
    expect(created.id).toMatch(/^loc_/)
  })
})

describe('backup', () => {
  it('never contains the Notion token', () => {
    const b = makeBackup(demo, { ...DEFAULT_SETTINGS, notionToken: 'ntn_secret' })
    expect(JSON.stringify(b)).not.toContain('ntn_secret')
  })
  it('round-trips and rejects files that are not backups', () => {
    const b = makeBackup(demo, DEFAULT_SETTINGS)
    expect(readBackup(JSON.stringify(b)).data.records).toHaveLength(demo.records.length)
    expect(() => readBackup('nope')).toThrow(BackupError)
    expect(() => readBackup(JSON.stringify({ app: 'other' }))).toThrow(/not an InFlow backup/)
    expect(() => readBackup(JSON.stringify({ ...b, version: 99 }))).toThrow(/newer/)
  })
  it('exports CSV with names, not ids', () => {
    const csv = recordsCsv(demo.records, demo)
    expect(csv.startsWith('﻿Date,Kind,Description')).toBe(true)
    expect(csv).toContain('Cost recovery')
    expect(csv).toContain('Nordwind Software SRL')
    expect(csv).not.toContain('demo_c_')
  })
})

describe('clearing demo data', () => {
  it('removes demo rows and keeps what the user entered, with the demo client it points at', () => {
    const mine = { ...demo.records[0], id: 'loc_1', demo: undefined }
    const cleaned = withoutDemo({ ...demo, records: [...demo.records, mine] })
    expect(cleaned.records).toEqual([mine])
    expect(cleaned.clients.map((c) => c.id)).toEqual([mine.clientId])
    expect(cleaned.venues.map((v) => v.id)).toEqual([mine.venueId])
  })
})

describe('the demo never reaches Notion', () => {
  it('refuses demo rows, rows linked to demo entities and demo ids, before any request', async () => {
    const call = vi.fn()
    const repo = new NotionRepo('t', 'inc', memoryStore(), call)
    const r = demo.records[0]
    await expect(repo.saveRecord(r)).rejects.toThrow(/demo/)
    await expect(repo.saveRecord({ ...r, id: '', demo: undefined })).rejects.toThrow(/demo/) // its client is a demo client
    await expect(repo.saveCost(demo.costs[0])).rejects.toThrow(/demo/)
    await expect(repo.saveEntity('client', demo.clients[0])).rejects.toThrow(/demo/)
    await expect(repo.deleteRecord(r.id)).rejects.toThrow(/demo/)
    await expect(repo.deleteEntity('venue', demo.venues[0].id)).rejects.toThrow(/demo/)
    expect(call).not.toHaveBeenCalled()
  })
})

describe('CSV is safe to open in a spreadsheet', () => {
  it('keeps text that looks like a formula as text', () => {
    const csv = toCsv(['a', 'b'], [['=HYPERLINK("x")', -350], ['+1 call', '@home'], ['plain', 12]])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain("'+1 call")
    expect(csv).toContain("'@home")
    expect(csv).toContain(',-350')
  })
})

describe('older data', () => {
  it('reads a payment saved before sessions and hours as one session, hours unknown', async () => {
    const { normalise } = await import('./repo')
    const old = { ...demo.records[0] } as Record<string, unknown>
    delete old.sessions
    delete old.hours
    const n = normalise({ records: [old as never], clients: [], sources: [], venues: [] })
    expect(n.records[0]).toMatchObject({ sessions: 1, hours: null })
  })
})

describe('refunds and venue-deal snapshots in storage', () => {
  const mine = withoutDemo(demo)
  const p = { ...demo.records.find((r) => r.status === 'received')!, id: 'loc_p', demo: undefined }

  it('device: data from before snapshots is migrated once on load, and written back', async () => {
    const venue = { ...demo.venues[0], id: 'loc_v', demo: undefined }
    const old = { records: [{ ...p, venueId: 'loc_v', dealTerms: undefined }], clients: [], sources: [], venues: [venue], costs: [] }
    const store = memoryStore({ data: old })
    const d = await new DeviceRepo(store).load()
    expect(d.records[0].dealTerms).toEqual({ deal: venue.deal, feePerSession: venue.feePerSession, sharePct: venue.sharePct, monthlyFee: venue.monthlyFee })
    expect(((await store.get('data')) as { schema: number }).schema).toBe(2)
  })

  it('device: refunds save, and go with their payment when it is deleted', async () => {
    const repo = new DeviceRepo(memoryStore({ data: { ...mine, records: [p] } }))
    await repo.load()
    const f = await repo.saveRefund({ id: '', paymentId: 'loc_p', date: p.date, amount: 10, currency: p.currency, fxRate: p.fxRate, amountRon: 10, notes: '' })
    expect(f.id).toMatch(/^loc_/)
    expect((await repo.load()).refunds).toHaveLength(1)
    await repo.deleteRecord('loc_p')
    expect((await repo.load()).refunds).toHaveLength(0)
  })

  it('Notion: the snapshot and a refund row map both ways; a balance payment keeps 0 sessions', () => {
    const r = { ...p, sessions: 0, dealTerms: { deal: 'share' as const, feePerSession: 0, sharePct: 0.3, monthlyFee: 0 } }
    const back = recordFromPage({ id: r.id, properties: asRead(recordToProps(r)) })
    expect(back.dealTerms).toEqual(r.dealTerms)
    expect(back.sessions).toBe(0)
    expect(termsFromText('')).toBeUndefined()
    expect(termsFromText('{"deal":null}')).toBeNull()
    expect(termsFromText('not json')).toBeUndefined()
    expect(termsToText(null)).toBe('{"deal":null}')
    const f = { id: 'f1', paymentId: 'abc123', date: '2026-04-05', amount: 40, currency: 'EUR' as const, fxRate: 5, amountRon: 200, notes: 'cancelled' }
    const page = { id: 'f1', properties: asRead(refundToProps(f, p)) }
    expect(isRefundPage(page)).toBe(true)
    expect(refundFromPage(page)).toEqual(f)
  })

  it('Notion: refunds come out of the Income database apart from payments; a refund needs its column', async () => {
    const pay = { id: 'pay1', properties: asRead(recordToProps({ ...p, venueId: null, clientId: null, sourceId: null })) }
    const ref = { id: 'ref1', properties: asRead(refundToProps({ id: '', paymentId: 'pay1', date: p.date, amount: 5, currency: p.currency, fxRate: p.fxRate, amountRon: 5, notes: '' }, undefined)) }
    const income = { Description: {}, Amount: {}, Date: {}, Taxability: {}, Client: { relation: { database_id: 'c1' } }, Source: { relation: { database_id: 's1' } }, Venue: { relation: { database_id: 'v1' } } }
    let patchFails = false
    const call = async (path: string, method: string) => {
      if (path === 'databases/inc' && method === 'GET') return { properties: income }
      if (path === 'databases/inc' && method === 'PATCH') { if (patchFails) throw new Error('no access'); return {} }
      if (path === 'databases/inc/query') return { results: [pay, ref], has_more: false }
      if (path.endsWith('/query')) return { results: [], has_more: false }
      return { id: 'new1' }
    }
    const d = await new NotionRepo('t', 'inc', memoryStore(), call).load()
    expect(d.records.map((r) => r.id)).toEqual(['pay1'])
    expect(d.refunds.map((f) => f.paymentId)).toEqual(['pay1'])
    patchFails = true
    const repo = new NotionRepo('t', 'inc', memoryStore(), call)
    await expect(repo.saveRefund({ ...d.refunds[0], id: '' })).rejects.toThrow(/Refund of/)
  })

  it('copying to Notion carries refunds over, pointing at the copied payment', async () => {
    const data = { ...mine, records: [p], refunds: [{ id: 'loc_f', paymentId: 'loc_p', date: p.date, amount: 5, currency: p.currency, fxRate: p.fxRate, amountRon: 5, notes: '' }] }
    const refunds: any[] = []
    let n = 0
    const repo = {
      kind: 'notion' as const, load: async () => data,
      saveRecord: async (r: any) => ({ ...r, id: `p${n++}` }), deleteRecord: async () => {},
      saveCost: async (c: any) => c, deleteCost: async () => {},
      saveEntity: async (_k: any, e: any) => ({ ...e, id: `e${n++}` }), deleteEntity: async () => {},
      saveRefund: async (f: any) => { refunds.push(f); return f }, deleteRefund: async () => {},
    }
    await copyToNotion(repo, data)
    expect(refunds).toHaveLength(1)
    expect(refunds[0].paymentId).toMatch(/^p\d+$/)
  })
})

describe('backups and their refunds (Release 1, D7)', () => {
  const p = { ...demo.records.find((r) => r.status === 'received')!, id: 'loc_p', demo: undefined }
  const f = { id: 'loc_f', paymentId: 'loc_p', date: p.date, amount: 10, currency: p.currency, fxRate: p.fxRate, amountRon: 10, notes: '' }
  const file = (refunds?: unknown) => JSON.stringify({ app: 'inflow', version: 1, exportedAt: 'x', settings: {}, data: { records: [p], clients: [], sources: [], venues: [], costs: [], ...(refunds === undefined ? {} : { refunds }) } })
  it('a current backup with refunds reads back whole, notes defaulted when missing', () => {
    const { notes: _n, ...noNotes } = f
    expect(readBackup(file([f, { ...noNotes, id: 'loc_g' }])).data.refunds).toEqual([f, { ...f, id: 'loc_g' }])
  })
  it('a backup from before refunds reads with none', () => {
    expect(readBackup(file()).data.refunds).toEqual([])
  })
  it('rejects a malformed refund, naming nothing it would silently drop', () => {
    for (const bad of [{}, { ...f, amount: 0 }, { ...f, amount: 'ten' }, { ...f, date: '1 May' }, { ...f, currency: 'XXX' }, { ...f, fxRate: 0 }, { ...f, id: '' }, null]) {
      expect(() => readBackup(file([f, bad]))).toThrow(/Nothing was restored/)
    }
    expect(() => readBackup(file([{ ...f, paymentId: 'gone' }]))).toThrow(/payment that isn't in it/)
    expect(() => readBackup(file({}))).toThrow(/damaged refunds list/)
  })
})
