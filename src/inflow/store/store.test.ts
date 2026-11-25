import { describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../../shared/kvStore'
import { buildDemo, withoutDemo } from '../data/demo'
import { DEFAULT_SETTINGS } from './settings'
import { BackupError, makeBackup, readBackup, recordsCsv } from './backup'
import {
  clientFromPage, clientToProps, copyToNotion, discoverDatabases, NotionRepo, recordFromPage, recordToProps,
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
  it('finds the three related databases from the Income link', async () => {
    const call = vi.fn(async () => ({ properties: incomeProps }))
    const dbs = await discoverDatabases(call, 'https://www.notion.so/InFlow-Income-423d3e6d60db8153942bd13b8b6922b2?v=1')
    expect(call).toHaveBeenCalledWith('databases/423d3e6d60db8153942bd13b8b6922b2', 'GET')
    expect(dbs).toEqual({ income: '423d3e6d60db8153942bd13b8b6922b2', clients: 'aaaa1', sources: 'bbbb2', venues: 'cccc3' })
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
    const saved = await repo.saveRecord({ ...demo.records[0], id: '' })
    expect(saved.id).toBe('newpageid')
    expect(saved.demo).toBeUndefined()
    expect(calls.at(-1)?.[2].parent).toEqual({ database_id: 'inc' })
    await repo.saveEntity('venue', { ...demo.venues[0], id: '' })
    expect(calls.at(-1)?.[2].parent).toEqual({ database_id: 'v1' })
    await repo.deleteRecord('xyz')
    expect(calls.at(-1)).toEqual(['pages/xyz', 'PATCH', { archived: true }])
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
