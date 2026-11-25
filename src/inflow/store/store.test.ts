import { describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { buildDemo, withoutDemo } from '../data/demo'
import { DEFAULT_SETTINGS } from './settings'
import { BackupError, makeBackup, readBackup, recordsCsv, toCsv } from './backup'
import {
  clientFromPage, clientToProps, copyToNotion, costFromPage, costToProps, discoverDatabases, NotionRepo, recordFromPage, recordToProps,
  sourceFromPage, sourceToProps, venueFromPage, venueToProps,
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
    expect(sent.every((k) => k in income)).toBe(true)
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
    }
    const count = await copyToNotion(repo, mine)
    expect(count).toBe(1)
    expect(saved[0].clientId).toMatch(/^p\d+$/)
    expect(saved[0].clientId).not.toBe(mine.records[0].clientId)
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
    expect(csv.startsWith('﻿Date,Description')).toBe(true)
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
