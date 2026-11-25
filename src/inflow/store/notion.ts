/**
 * InFlow in Notion: four databases, reached through the site's `/api/notion`
 * relay with the user's own integration token (bring-your-own-key; nothing is
 * stored server-side).
 *
 * Settings ask for one link, the Income database's. The other three are found
 * through Income's relation properties, so a user who duplicates the Starter
 * Template only ever pastes one URL. Property names below must match the live
 * schema in INFLOW.md, "Notion".
 *
 * The last successful load is cached on the device, so the app opens with
 * your numbers even offline; writes need the network and say so when it's gone.
 */
import type { KeyValueStore } from '../../shared/kvStore'
import { notionProxy } from '../../shared/notionClient'
import { parseNotionId } from '../../shared/notionId'
import type { Category, Client, Currency, IncomeRecord, InflowData, Source, Venue } from '../domain/types'
import {
  CATEGORY, CLIENT_COUNTRY, CLIENT_KIND, CURRENCIES, SOURCE_TAX_DEFAULT, SOURCE_TYPE, STATUS,
  TAX_HANDLING, TAXABILITY, VAT, VENUE_TYPE, fromLabel,
} from '../domain/vocabulary'
import { round2 } from '../lib/money'
import { EMPTY, type Entity, type EntityKind, type Repo } from './repo'

export const CACHE_KEY = 'notion-cache'

type Props = Record<string, any>
type Call = (path: string, method: string, body?: unknown) => Promise<Record<string, any>>

// ── property readers ────────────────────────────────────────────────────────
const text = (p: any): string => (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? '').join('')
const num = (p: any): number | null => (typeof p?.number === 'number' ? p.number : null)
const sel = (p: any): string | null => p?.select?.name ?? null
const rel = (p: any): string | null => p?.relation?.[0]?.id?.replace(/-/g, '') ?? null
const chk = (p: any): boolean => !!p?.checkbox
const date = (p: any): string => (p?.date?.start ?? '').slice(0, 10)

// ── property writers ────────────────────────────────────────────────────────
/** Notion caps one rich-text run at 2,000 characters; longer text goes in several. */
export function richText(s: string) {
  const runs = []
  for (let i = 0; i < s.length; i += 2000) runs.push({ type: 'text', text: { content: s.slice(i, i + 2000) } })
  return runs
}
const wTitle = (s: string) => ({ title: richText(s || 'Untitled') })
const wText = (s: string) => ({ rich_text: richText(s || '') })
const wNum = (n: number | null) => ({ number: n === null || !Number.isFinite(n) ? null : n })
const wSel = (name: string | null) => ({ select: name ? { name } : null })
const wRel = (id: string | null) => ({ relation: id ? [{ id }] : [] })
const wChk = (b: boolean) => ({ checkbox: !!b })

// ── mappers (pure; tested) ──────────────────────────────────────────────────
export function recordFromPage(page: { id: string; properties: Props }): IncomeRecord {
  const p = page.properties
  const currencyName = sel(p['Currency'])
  const currency = (CURRENCIES as string[]).includes(currencyName ?? '') ? (currencyName as Currency) : 'RON'
  const amount = num(p['Amount']) ?? 0
  const fxRate = num(p['FX rate']) ?? (currency === 'RON' ? 1 : 0)
  const amountRon = num(p['Amount RON']) ?? round2(amount * fxRate)
  const reserve = num(p['Tax reserve RON'])
  return {
    id: page.id.replace(/-/g, ''),
    description: text(p['Description']),
    amount,
    currency,
    fxRate,
    amountRon,
    date: date(p['Date']),
    status: fromLabel(STATUS, sel(p['Status']), 'received'),
    clientId: rel(p['Client']),
    sourceId: rel(p['Source']),
    venueId: rel(p['Venue']),
    category: sel(p['Category']) ? fromLabel<Category>(CATEGORY, sel(p['Category']), 'other') : null,
    recurring: chk(p['Recurring']),
    notes: text(p['Notes']),
    taxability: fromLabel(TAXABILITY, sel(p['Taxability']), 'review'),
    taxHandling: fromLabel(TAX_HANDLING, sel(p['Tax handling']), 'other'),
    vat: fromLabel(VAT, sel(p['VAT']), 'undetermined'),
    classification: sel(p['Classification']) === 'Confirmed' ? 'confirmed' : 'suggested',
    taxReserve: reserve,
    reserveSource: sel(p['Reserve source']) === 'Manual' ? 'manual' : reserve === null ? null : 'suggested',
    taxWithheld: num(p['Tax withheld RON']) ?? 0,
    taxRules: text(p['Tax rules']),
  }
}

export function recordToProps(r: IncomeRecord): Props {
  return {
    'Description': wTitle(r.description),
    'Amount': wNum(r.amount),
    'Currency': wSel(r.currency),
    'FX rate': wNum(r.fxRate),
    'Amount RON': wNum(r.amountRon),
    'Date': { date: r.date ? { start: r.date } : null },
    'Status': wSel(STATUS[r.status]),
    'Client': wRel(r.clientId),
    'Source': wRel(r.sourceId),
    'Venue': wRel(r.venueId),
    'Category': wSel(r.category ? CATEGORY[r.category] : null),
    'Recurring': wChk(r.recurring),
    'Notes': wText(r.notes),
    'Taxability': wSel(TAXABILITY[r.taxability]),
    'Tax handling': wSel(TAX_HANDLING[r.taxHandling]),
    'VAT': wSel(VAT[r.vat]),
    'Classification': wSel(r.classification === 'confirmed' ? 'Confirmed' : 'Suggested'),
    'Tax reserve RON': wNum(r.taxReserve),
    'Reserve source': wSel(r.reserveSource === 'manual' ? 'Manual' : r.reserveSource === 'suggested' ? 'Suggested' : null),
    'Tax withheld RON': wNum(r.taxWithheld),
    'Tax rules': wText(r.taxRules),
  }
}

export function clientFromPage(page: { id: string; properties: Props }): Client {
  const p = page.properties
  return {
    id: page.id.replace(/-/g, ''),
    name: text(p['Name']),
    kind: fromLabel(CLIENT_KIND, sel(p['Kind']), 'individual'),
    country: fromLabel(CLIENT_COUNTRY, sel(p['Country']), 'RO'),
    contact: text(p['Contact']),
    notes: text(p['Notes']),
    archived: chk(p['Archived']),
  }
}

export function clientToProps(c: Client): Props {
  return {
    'Name': wTitle(c.name), 'Kind': wSel(CLIENT_KIND[c.kind]), 'Country': wSel(CLIENT_COUNTRY[c.country]),
    'Contact': wText(c.contact), 'Notes': wText(c.notes), 'Archived': wChk(c.archived),
  }
}

export function sourceFromPage(page: { id: string; properties: Props }): Source {
  const p = page.properties
  return {
    id: page.id.replace(/-/g, ''),
    name: text(p['Name']),
    type: fromLabel(SOURCE_TYPE, sel(p['Type']), 'other'),
    description: text(p['Description']),
    active: chk(p['Active']),
    taxDefault: fromLabel(SOURCE_TAX_DEFAULT, sel(p['Tax default']), 'profile'),
  }
}

export function sourceToProps(s: Source): Props {
  return {
    'Name': wTitle(s.name), 'Type': wSel(SOURCE_TYPE[s.type]), 'Description': wText(s.description),
    'Active': wChk(s.active), 'Tax default': wSel(SOURCE_TAX_DEFAULT[s.taxDefault]),
  }
}

export function venueFromPage(page: { id: string; properties: Props }): Venue {
  const p = page.properties
  return {
    id: page.id.replace(/-/g, ''),
    name: text(p['Name']),
    type: fromLabel(VENUE_TYPE, sel(p['Type']), 'in_person'),
    location: text(p['Location']),
    notes: text(p['Notes']),
    archived: chk(p['Archived']),
  }
}

export function venueToProps(v: Venue): Props {
  return {
    'Name': wTitle(v.name), 'Type': wSel(VENUE_TYPE[v.type]), 'Location': wText(v.location),
    'Notes': wText(v.notes), 'Archived': wChk(v.archived),
  }
}

// ── the repo ────────────────────────────────────────────────────────────────
export interface NotionDbs {
  income: string
  clients: string
  sources: string
  venues: string
}

/** Find the Clients, Sources and Venues databases through Income's relation properties. */
export async function discoverDatabases(call: Call, incomeDbId: string): Promise<NotionDbs> {
  const income = parseNotionId(incomeDbId) || incomeDbId
  const db = await call(`databases/${income}`, 'GET')
  const props = (db.properties ?? {}) as Props
  const target = (name: string) => String(props[name]?.relation?.database_id ?? '').replace(/-/g, '')
  const dbs = { income, clients: target('Client'), sources: target('Source'), venues: target('Venue') }
  const missing = ['Description', 'Amount', 'Date', 'Taxability'].filter((p) => !props[p])
  if (missing.length) throw new Error(`That database is missing ${missing.join(', ')}. Paste the link of "InFlow — Income".`)
  if (!dbs.clients || !dbs.sources || !dbs.venues) {
    throw new Error('Connected, but the Client, Source or Venue relation is missing. Share all four InFlow databases with your integration.')
  }
  return dbs
}

async function queryAll(call: Call, dbId: string): Promise<{ id: string; properties: Props }[]> {
  const out: { id: string; properties: Props }[] = []
  let cursor: string | undefined
  do {
    const res = await call(`databases/${dbId}/query`, 'POST', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
    out.push(...(res.results ?? []))
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return out
}

const TO_PROPS: Record<EntityKind, (e: any) => Props> = { client: clientToProps, source: sourceToProps, venue: venueToProps }

export class NotionRepo implements Repo {
  readonly kind = 'notion' as const
  private dbs: NotionDbs | null = null
  private call: Call

  constructor(token: string, private incomeDbId: string, private cache: KeyValueStore, call?: Call) {
    this.call = call ?? ((path, method, body) => notionProxy(token, path, method, body))
  }

  private async databases(): Promise<NotionDbs> {
    if (!this.dbs) this.dbs = await discoverDatabases(this.call, this.incomeDbId)
    return this.dbs
  }

  async load(): Promise<InflowData> {
    const dbs = await this.databases()
    const [records, clients, sources, venues] = await Promise.all([
      queryAll(this.call, dbs.income), queryAll(this.call, dbs.clients),
      queryAll(this.call, dbs.sources), queryAll(this.call, dbs.venues),
    ])
    const data: InflowData = {
      records: records.map(recordFromPage).filter((r) => r.date),
      clients: clients.map(clientFromPage),
      sources: sources.map(sourceFromPage),
      venues: venues.map(venueFromPage),
    }
    await this.cache.set(CACHE_KEY, data).catch(() => {})
    return data
  }

  /** The last data loaded from Notion on this device, for opening offline. */
  async cached(): Promise<InflowData> {
    return (await this.cache.get<InflowData>(CACHE_KEY)) ?? EMPTY
  }

  async saveRecord(r: IncomeRecord): Promise<IncomeRecord> {
    const dbs = await this.databases()
    const properties = recordToProps(r)
    const page = r.id
      ? await this.call(`pages/${r.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: dbs.income }, properties })
    return { ...r, id: String(page.id).replace(/-/g, ''), demo: undefined }
  }

  async deleteRecord(id: string): Promise<void> {
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
  }

  async saveEntity<T extends Entity>(kind: EntityKind, e: T): Promise<T> {
    const dbs = await this.databases()
    const db = kind === 'client' ? dbs.clients : kind === 'source' ? dbs.sources : dbs.venues
    const properties = TO_PROPS[kind](e)
    const page = e.id
      ? await this.call(`pages/${e.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: db }, properties })
    return { ...e, id: String(page.id).replace(/-/g, ''), demo: undefined }
  }

  async deleteEntity(_kind: EntityKind, id: string): Promise<void> {
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
  }
}

/**
 * Copy what was entered on this device into Notion: entities first, so the
 * records can point at their new Notion ids. Demo rows are never copied.
 * Returns how many records were written.
 */
export async function copyToNotion(repo: Repo, data: InflowData, onProgress?: (done: number, total: number) => void): Promise<number> {
  const records = data.records.filter((r) => !r.demo)
  const used = new Set(records.flatMap((r) => [r.clientId, r.sourceId, r.venueId]))
  const idMap = new Map<string, string>()
  const kinds: [EntityKind, Entity[]][] = [['client', data.clients], ['source', data.sources], ['venue', data.venues]]
  const entities = kinds.flatMap(([k, list]) => list.filter((e) => !e.demo || used.has(e.id)).map((e) => [k, e] as const))
  const total = entities.length + records.length
  let done = 0
  for (const [kind, e] of entities) {
    const saved = await repo.saveEntity(kind, { ...e, id: '', demo: undefined })
    idMap.set(e.id, saved.id)
    onProgress?.(++done, total)
  }
  for (const r of records) {
    const map = (id: string | null) => (id ? idMap.get(id) ?? null : null)
    await repo.saveRecord({ ...r, id: '', clientId: map(r.clientId), sourceId: map(r.sourceId), venueId: map(r.venueId) })
    onProgress?.(++done, total)
  }
  return records.length
}
