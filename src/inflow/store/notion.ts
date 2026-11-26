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
import type { Category, Client, CostRecord, Currency, DealTerms, IncomeRecord, InflowData, Refund, Source, Venue } from '../domain/types'
import {
  CATEGORY, CLIENT_COUNTRY, COST_CATEGORY, DEAL, COST_GROUP_SHORT, COST_STATUS, CLIENT_KIND, CURRENCIES, SOURCE_TAX_DEFAULT, SOURCE_TYPE, STATUS,
  TAX_HANDLING, TAXABILITY, VAT, VENUE_TYPE, fromLabel,
} from '../domain/vocabulary'
import { round2 } from '../lib/money'
import { listKey, normalise, type Entity, type EntityKind, type Repo } from './repo'
import { reliable, type Call, type CallOptions } from './notionCall'

export const CACHE_KEY = 'notion-cache'

/**
 * The demo never reaches Notion. The app keeps it in its own workspace; this is
 * the second lock, should a demo row ever be on screen while Notion is the repo.
 */
export function refuseDemo(row: { demo?: boolean }, ids: (string | null | undefined)[]): void {
  if (row.demo || ids.some((id) => id && id.startsWith('demo_'))) {
    throw new Error('That belongs to the demo, which never goes to Notion. Switch to the demo to change it.')
  }
}

type Props = Record<string, any>

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
/** A payment's venue-deal snapshot, kept in Notion as a short JSON text ("Venue terms"). */
export function termsFromText(s: string): DealTerms | null | undefined {
  if (!s.trim()) return undefined
  try {
    // Tolerate braces escaped by a Markdown-minded tool (\{…\}): otherwise the snapshot would be
    // dropped silently and the payment counted under the venue's current deal.
    const t = JSON.parse(s.trim().replace(/\\([{}])/g, '$1'))
    if (!t || typeof t !== 'object') return undefined
    if (t.deal === null) return null
    if (!(Object.keys(DEAL) as string[]).includes(t.deal)) return undefined
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
    return { deal: t.deal, feePerSession: n(t.feePerSession), sharePct: n(t.sharePct), monthlyFee: n(t.monthlyFee) }
  } catch { return undefined }
}

export const termsToText = (t: DealTerms | null | undefined): string =>
  t === undefined ? '' : t === null ? '{"deal":null}' : JSON.stringify({ deal: t.deal, feePerSession: t.feePerSession, sharePct: t.sharePct, monthlyFee: t.monthlyFee })

/** Refunds live in the Income database too, as rows with Status "Refund" pointing at their payment. */
export const REFUND_STATUS = 'Refund'
export const isRefundPage = (page: { properties: Props }): boolean => sel(page.properties['Status']) === REFUND_STATUS

export function refundFromPage(page: { id: string; properties: Props }): Refund {
  const p = page.properties
  const currencyName = sel(p['Currency'])
  const currency = (CURRENCIES as string[]).includes(currencyName ?? '') ? (currencyName as Currency) : 'RON'
  const amount = Math.abs(num(p['Amount']) ?? 0)
  const fxRate = num(p['FX rate']) ?? (currency === 'RON' ? 1 : 0)
  return {
    id: page.id.replace(/-/g, ''),
    paymentId: text(p['Refund of']).replace(/-/g, '').trim(),
    date: date(p['Date']),
    amount,
    currency,
    fxRate,
    amountRon: Math.abs(num(p['Amount RON']) ?? round2(amount * fxRate)),
    notes: text(p['Notes']),
  }
}

/** A refund row: positive amounts, as entered; the Status says what it is. */
export function refundToProps(f: Refund, payment: Pick<IncomeRecord, 'description' | 'clientId' | 'sourceId' | 'venueId'> | undefined): Props {
  return {
    'Description': wTitle(`Refund: ${payment?.description ?? ''}`.trim()),
    'Amount': wNum(f.amount),
    'Currency': wSel(f.currency),
    'FX rate': wNum(f.fxRate),
    'Amount RON': wNum(f.amountRon),
    'Date': { date: f.date ? { start: f.date } : null },
    'Status': wSel(REFUND_STATUS),
    'Refund of': wText(f.paymentId),
    'Client': wRel(payment?.clientId ?? null),
    'Source': wRel(payment?.sourceId ?? null),
    'Venue': wRel(payment?.venueId ?? null),
    'Notes': wText(f.notes),
  }
}

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
    attendees: num(p['Attendees']),
    // 0 is a balance payment's (a partial receipt's remainder); only a missing value means 1.
    sessions: Math.max(0, num(p['Sessions']) ?? 1),
    hours: num(p['Hours']),
    taxability: fromLabel(TAXABILITY, sel(p['Taxability']), 'review'),
    taxHandling: fromLabel(TAX_HANDLING, sel(p['Tax handling']), 'other'),
    vat: fromLabel(VAT, sel(p['VAT']), 'undetermined'),
    classification: sel(p['Classification']) === 'Confirmed' ? 'confirmed' : 'suggested',
    taxReserve: reserve,
    reserveSource: sel(p['Reserve source']) === 'Manual' ? 'manual' : reserve === null ? null : 'suggested',
    taxWithheld: num(p['Tax withheld RON']) ?? 0,
    taxRules: text(p['Tax rules']),
    dealTerms: termsFromText(text(p['Venue terms'])),
    ...(text(p['Repays cost']).trim() ? { repaysCostId: text(p['Repays cost']).replace(/-/g, '').trim() } : {}),
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
    'Attendees': wNum(r.attendees),
    'Sessions': wNum(r.sessions),
    'Hours': wNum(r.hours),
    'Taxability': wSel(TAXABILITY[r.taxability]),
    'Tax handling': wSel(TAX_HANDLING[r.taxHandling]),
    'VAT': wSel(VAT[r.vat]),
    'Classification': wSel(r.classification === 'confirmed' ? 'Confirmed' : 'Suggested'),
    'Tax reserve RON': wNum(r.taxReserve),
    'Reserve source': wSel(r.reserveSource === 'manual' ? 'Manual' : r.reserveSource === 'suggested' ? 'Suggested' : null),
    'Tax withheld RON': wNum(r.taxWithheld),
    'Tax rules': wText(r.taxRules),
    'Venue terms': wText(termsToText(r.dealTerms)),
    'Repays cost': wText(r.repaysCostId ?? ''),
  }
}

export function costFromPage(page: { id: string; properties: Props }): CostRecord {
  const p = page.properties
  const currencyName = sel(p['Currency'])
  const currency = (CURRENCIES as string[]).includes(currencyName ?? '') ? (currencyName as Currency) : 'RON'
  const amount = num(p['Amount']) ?? 0
  const fxRate = num(p['FX rate']) ?? (currency === 'RON' ? 1 : 0)
  const group = fromLabel<CostRecord['group']>(COST_GROUP_SHORT, sel(p['Group']), 'operating')
  return {
    id: page.id.replace(/-/g, ''),
    description: text(p['Description']),
    amount,
    currency,
    fxRate,
    amountRon: num(p['Amount RON']) ?? round2(amount * fxRate),
    date: date(p['Date']),
    status: fromLabel(COST_STATUS, sel(p['Status']), 'paid'),
    group,
    category: fromLabel<CostRecord['category']>(COST_CATEGORY, sel(p['Category']), group === 'direct' ? 'materials' : 'other_operating'),
    venueId: rel(p['Venue']),
    clientId: rel(p['Client']),
    activity: sel(p['Activity']) ? fromLabel<Category>(CATEGORY, sel(p['Activity']), 'other') : null,
    recurring: chk(p['Recurring']),
    deductible: chk(p['Deductible']),
    notes: text(p['Notes']),
  }
}

export function costToProps(c: CostRecord): Props {
  return {
    'Description': wTitle(c.description),
    'Amount': wNum(c.amount),
    'Currency': wSel(c.currency),
    'FX rate': wNum(c.fxRate),
    'Amount RON': wNum(c.amountRon),
    'Date': { date: c.date ? { start: c.date } : null },
    'Status': wSel(COST_STATUS[c.status]),
    'Group': wSel(COST_GROUP_SHORT[c.group]),
    'Category': wSel(COST_CATEGORY[c.category]),
    'Venue': wRel(c.venueId),
    'Client': wRel(c.clientId),
    'Activity': wSel(c.activity ? CATEGORY[c.activity] : null),
    'Recurring': wChk(c.recurring),
    'Deductible': wChk(c.deductible),
    'Notes': wText(c.notes),
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
    deal: fromLabel<Venue['deal']>(DEAL, sel(p['Deal']), 'none'),
    feePerSession: num(p['Fee per session']) ?? 0,
    // Notion holds the share as a percent (30); the app as a fraction (0.3).
    sharePct: (num(p['Share %']) ?? 0) / 100,
    monthlyFee: num(p['Monthly fee']) ?? 0,
  }
}

export function venueToProps(v: Venue): Props {
  return {
    'Name': wTitle(v.name), 'Type': wSel(VENUE_TYPE[v.type]), 'Location': wText(v.location),
    'Notes': wText(v.notes), 'Archived': wChk(v.archived),
    'Deal': wSel(DEAL[v.deal]), 'Fee per session': wNum(v.feePerSession),
    'Share %': wNum(Math.round(v.sharePct * 10000) / 100), 'Monthly fee': wNum(v.monthlyFee),
  }
}

// ── the repo ────────────────────────────────────────────────────────────────
/**
 * A copied row carries the id it had on the device, in this text column, on every InFlow
 * database: a copy that lost Notion's answer can then find the row instead of making it twice.
 */
export const INFLOW_ID = 'InFlow ID'

/** Options a save takes from the copy to Notion; ordinary saves pass none. */
export interface SaveOptions {
  /** The row's device id, written to "InFlow ID". */
  inflowId?: string
}

export type CopyKind = EntityKind | 'record' | 'cost' | 'refund'

const withInflowId = (props: Props, opts: SaveOptions): Props => (opts.inflowId ? { ...props, [INFLOW_ID]: wText(opts.inflowId) } : props)

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

export interface NotionDbs {
  income: string
  clients: string
  sources: string
  venues: string
  /** Optional: found as a sibling of Income on its parent page; null if there is none. */
  costs: string | null
}

/** Find the Clients, Sources and Venues databases through Income's relation properties. */
export async function discoverDatabases(call: Call, incomeDbId: string): Promise<NotionDbs> {
  const income = parseNotionId(incomeDbId) || incomeDbId
  const db = await call(`databases/${income}`, 'GET')
  const props = (db.properties ?? {}) as Props
  const target = (name: string) => String(props[name]?.relation?.database_id ?? '').replace(/-/g, '')
  const dbs: NotionDbs = { income, clients: target('Client'), sources: target('Source'), venues: target('Venue'), costs: null }
  const missing = ['Description', 'Amount', 'Date', 'Taxability'].filter((p) => !props[p])
  if (missing.length) throw new Error(`That database is missing ${missing.join(', ')}. Paste the link of "InFlow — Income".`)
  if (!dbs.clients || !dbs.sources || !dbs.venues) {
    throw new Error('Connected, but the Client, Source or Venue relation is missing. Share all four InFlow databases with your integration.')
  }
  dbs.costs = await findCostsDb(call, db)
  return dbs
}

/** Costs isn't linked from Income, so look for "… Costs" among Income's siblings on its page. */
async function findCostsDb(call: Call, incomeDb: Record<string, any>): Promise<string | null> {
  const pageId = incomeDb?.parent?.type === 'page_id' ? incomeDb.parent.page_id : null
  if (!pageId) return null
  try {
    let cursor: string | undefined
    do {
      const res = await call(`blocks/${String(pageId).replace(/-/g, '')}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, 'GET')
      const hit = (res.results ?? []).find((b: any) => b.type === 'child_database' && /costs\s*$/i.test(b.child_database?.title ?? ''))
      if (hit) return String(hit.id).replace(/-/g, '')
      cursor = res.has_more ? res.next_cursor : undefined
    } while (cursor)
  } catch {
    // Without access to the page, costs are simply unavailable; income still works.
  }
  return null
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
  /** Each database's column names, read once: only those are written. */
  private columns = new Map<string, Promise<Set<string> | null>>()
  /** Whether a Costs database was found next to Income. */
  hasCosts = false

  /** What was last loaded, kept up to date by every write, and mirrored to the device cache (audit B-09). */
  private data: InflowData | null = null

  /** `call` is injected in tests; either way it is paced and retried (`notionCall.ts`). */
  constructor(token: string, private incomeDbId: string, private cache: KeyValueStore, call?: Call, opts: CallOptions = {}) {
    this.call = reliable(call ?? ((path, method, body) => notionProxy(token, path, method, body)), opts)
  }

  /**
   * After a write, the offline copy follows: opened without a connection, the app shows what was
   * saved this session, not only what the last full load brought (audit B-09).
   */
  private async remember(fn: (d: InflowData) => InflowData): Promise<void> {
    if (!this.data) return
    this.data = fn(this.data)
    await this.cache.set(CACHE_KEY, this.data).catch(() => {})
  }

  private async databases(): Promise<NotionDbs> {
    if (!this.dbs) this.dbs = await discoverDatabases(this.call, this.incomeDbId)
    return this.dbs
  }

  /**
   * The properties a database actually has. A database duplicated before a column was added
   * (Sessions, Hours, Attendees, a venue's deal) would refuse the whole page if it were named,
   * so those are left out and the rest saves. If the schema can't be read, everything is sent.
   */
  private async fit(dbId: string, props: Props): Promise<Props> {
    if (!this.columns.has(dbId)) {
      this.columns.set(dbId, this.call(`databases/${dbId}`, 'GET')
        .then((db) => new Set(Object.keys(db.properties ?? {})))
        .catch(() => null))
    }
    const known = await this.columns.get(dbId)!
    if (!known || known.size === 0) return props
    return Object.fromEntries(Object.entries(props).filter(([k]) => known.has(k)))
  }

  /**
   * Adds text columns a database lacks (a database duplicated before they existed). Returns
   * whether they are there now: a token without permission to change the schema can't add them.
   */
  private async ensureText(dbId: string, names: string[]): Promise<boolean> {
    await this.fit(dbId, {})
    const known = await this.columns.get(dbId)!
    // Schema unreadable (or read as empty): `fit` then sends every column, these included.
    if (!known || known.size === 0) return true
    const missing = names.filter((n) => !known.has(n))
    if (!missing.length) return true
    try {
      await this.call(`databases/${dbId}`, 'PATCH', { properties: Object.fromEntries(missing.map((n) => [n, { rich_text: {} }])) })
      for (const n of missing) known.add(n)
      return true
    } catch {
      return false
    }
  }

  /** The database a copied row of this kind lives in. */
  private async dbFor(kind: CopyKind): Promise<string | null> {
    const dbs = await this.databases()
    return kind === 'record' || kind === 'refund' ? dbs.income : kind === 'cost' ? dbs.costs
      : kind === 'client' ? dbs.clients : kind === 'source' ? dbs.sources : dbs.venues
  }

  /**
   * Makes sure every InFlow database has its "InFlow ID" column, so a copy can tell whether a row
   * already reached Notion (D3). False when one couldn't be added (no permission to change it).
   */
  async prepareInflowIds(): Promise<boolean> {
    const dbs = await this.databases()
    let ok = true
    for (const db of [dbs.income, dbs.clients, dbs.sources, dbs.venues, dbs.costs]) {
      if (db && !(await this.ensureText(db, [INFLOW_ID]))) ok = false
    }
    return ok
  }

  /** The Notion page holding the device row with this InFlow ID, if one was already copied. */
  async findCopied(kind: CopyKind, inflowId: string): Promise<string | null> {
    const db = await this.dbFor(kind)
    if (!db) return null
    const res = await this.call(`databases/${db}/query`, 'POST', { page_size: 1, filter: { property: INFLOW_ID, rich_text: { equals: inflowId } } })
    const hit = (res.results ?? [])[0]
    return hit ? String(hit.id).replace(/-/g, '') : null
  }

  async load(): Promise<InflowData> {
    const dbs = await this.databases()
    // One database after another, each page after the last: never a burst the relay turns away (audit A-03).
    const records = await queryAll(this.call, dbs.income)
    const clients = await queryAll(this.call, dbs.clients)
    const sources = await queryAll(this.call, dbs.sources)
    const venues = await queryAll(this.call, dbs.venues)
    const costs = dbs.costs ? await queryAll(this.call, dbs.costs) : []
    this.hasCosts = !!dbs.costs
    const data: InflowData = {
      records: records.filter((p) => !isRefundPage(p)).map(recordFromPage).filter((r) => r.date),
      costs: costs.map(costFromPage).filter((c) => c.date),
      clients: clients.map(clientFromPage),
      sources: sources.map(sourceFromPage),
      venues: venues.map(venueFromPage),
      refunds: records.filter(isRefundPage).map(refundFromPage).filter((f) => f.date && f.paymentId),
    }
    this.data = data
    await this.cache.set(CACHE_KEY, data).catch(() => {})
    return data
  }

  /** The last data loaded from Notion on this device, for opening offline. */
  async cached(): Promise<InflowData> {
    return normalise(await this.cache.get<InflowData>(CACHE_KEY))
  }

  async saveRecord(r: IncomeRecord, opts: SaveOptions = {}): Promise<IncomeRecord> {
    refuseDemo(r, [r.id, r.clientId, r.sourceId, r.venueId])
    const dbs = await this.databases()
    // The venue-deal snapshot needs its column; without it the payment still saves (see "Venue terms").
    if (r.dealTerms !== undefined) await this.ensureText(dbs.income, ['Venue terms'])
    // A reimbursement's link to its cost; without the column the payment still saves, unlinked.
    if (r.repaysCostId) await this.ensureText(dbs.income, ['Repays cost'])
    const properties = await this.fit(dbs.income, withInflowId(recordToProps(r), opts))
    const page = r.id
      ? await this.call(`pages/${r.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: dbs.income }, properties })
    const saved = { ...r, id: String(page.id).replace(/-/g, ''), demo: undefined }
    await this.remember((d) => ({ ...d, records: upsert(d.records, saved) }))
    return saved
  }

  /** The payment's refunds are archived with it, so none is left pointing at nothing. */
  async deleteRecord(id: string, refundIds: string[] = []): Promise<void> {
    refuseDemo({}, [id])
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
    for (const f of refundIds) await this.call(`pages/${f}`, 'PATCH', { archived: true })
    await this.remember((d) => ({ ...d, records: d.records.filter((r) => r.id !== id), refunds: d.refunds.filter((f) => f.paymentId !== id) }))
  }

  /** `payment` is the refunded payment as loaded, for the row's description and links. */
  async saveRefund(f: Refund, payment?: IncomeRecord, opts: SaveOptions = {}): Promise<Refund> {
    refuseDemo(f, [f.id, f.paymentId])
    const dbs = await this.databases()
    if (!(await this.ensureText(dbs.income, ['Refund of']))) {
      throw new Error('Your Income database in Notion has no "Refund of" column, and InFlow could not add it. Add a text property named "Refund of", then try again.')
    }
    const properties = await this.fit(dbs.income, withInflowId(refundToProps(f, payment), opts))
    const page = f.id
      ? await this.call(`pages/${f.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: dbs.income }, properties })
    const saved = { ...f, id: String(page.id).replace(/-/g, ''), demo: undefined }
    await this.remember((d) => ({ ...d, refunds: upsert(d.refunds, saved) }))
    return saved
  }

  async deleteRefund(id: string): Promise<void> {
    refuseDemo({}, [id])
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
    await this.remember((d) => ({ ...d, refunds: d.refunds.filter((f) => f.id !== id) }))
  }

  async saveCost(c: CostRecord, opts: SaveOptions = {}): Promise<CostRecord> {
    refuseDemo(c, [c.id, c.clientId, c.venueId])
    const dbs = await this.databases()
    if (!dbs.costs) throw new Error('No "InFlow — Costs" database next to Income in Notion. Duplicate it from the Starter Template.')
    const properties = await this.fit(dbs.costs, withInflowId(costToProps(c), opts))
    const page = c.id
      ? await this.call(`pages/${c.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: dbs.costs }, properties })
    const saved = { ...c, id: String(page.id).replace(/-/g, ''), demo: undefined }
    await this.remember((d) => ({ ...d, costs: upsert(d.costs, saved) }))
    return saved
  }

  async deleteCost(id: string): Promise<void> {
    refuseDemo({}, [id])
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
    await this.remember((d) => ({ ...d, costs: d.costs.filter((c) => c.id !== id) }))
  }

  async saveEntity<T extends Entity>(kind: EntityKind, e: T, opts: SaveOptions = {}): Promise<T> {
    refuseDemo(e, [e.id])
    const dbs = await this.databases()
    const db = kind === 'client' ? dbs.clients : kind === 'source' ? dbs.sources : dbs.venues
    const properties = await this.fit(db, withInflowId(TO_PROPS[kind](e), opts))
    const page = e.id
      ? await this.call(`pages/${e.id}`, 'PATCH', { properties })
      : await this.call('pages', 'POST', { parent: { database_id: db }, properties })
    const saved = { ...e, id: String(page.id).replace(/-/g, ''), demo: undefined }
    const key = listKey(kind)
    await this.remember((d) => ({ ...d, [key]: upsert(d[key] as Entity[], saved) }))
    return saved
  }

  async deleteEntity(kind: EntityKind, id: string): Promise<void> {
    refuseDemo({}, [id])
    await this.call(`pages/${id}`, 'PATCH', { archived: true })
    const key = listKey(kind)
    const field = kind === 'client' ? 'clientId' : kind === 'source' ? 'sourceId' : 'venueId'
    await this.remember((d) => ({
      ...d,
      [key]: (d[key] as Entity[]).filter((x) => x.id !== id),
      records: d.records.map((r) => (r[field] === id ? { ...r, [field]: null } : r)),
    }))
  }
}

/**
 * Which of this device's rows are already in Notion, by device id → Notion page id. Kept on the
 * device per Income database (`inflow:notion-copy:<db>`), written after every row, so a copy that
 * stops partway (offline, a refusal) resumes where it stopped, and running it again copies only
 * what is new: never a second copy of anything (audit A-03).
 */
export interface CopyLog {
  get(key: string): string | undefined
  put(key: string, notionId: string): void
}

/** In the copy log: sent to Notion, answer not yet seen. Never a Notion id. */
export const PENDING = 'pending'

export function memoryCopyLog(seed: Record<string, string> = {}): CopyLog & { entries: Record<string, string> } {
  const entries = { ...seed }
  return { entries, get: (k) => entries[k], put: (k, v) => { entries[k] = v } }
}

export interface CopyResult {
  /** Rows written this time. */
  copied: number
  /** Rows already in Notion from an earlier run, left alone. */
  skipped: number
  /** Of `skipped`: rows an earlier run sent without seeing Notion's answer, found in Notion by their InFlow ID. */
  recovered: number
}

/** What a repo offers the copy to check for rows already sent (NotionRepo; see D3 in INFLOW.md). */
interface CopyChecks {
  prepareInflowIds(): Promise<boolean>
  findCopied(kind: CopyKind, inflowId: string): Promise<string | null>
}
const checksOf = (repo: Repo): CopyChecks | null =>
  'findCopied' in repo && 'prepareInflowIds' in repo ? (repo as unknown as CopyChecks) : null

/** Thrown when a row may already be in Notion and can't be checked: copying it again could duplicate it. */
export class CopyUncertain extends Error {}

/**
 * Copy what was entered on this device into Notion: entities first, so the records can point at
 * their Notion ids, then costs, payments (a reimbursement pointing at its copied cost) and refunds.
 * Demo rows are never copied.
 *
 * One row at a time. Each is logged as pending before it is sent and with its Notion id once Notion
 * answers, and carries its device id in "InFlow ID". So a run that stops partway resumes where it
 * stopped, and a row whose answer was lost (sent, accepted, but the connection dropped) is looked up
 * by its InFlow ID on the next run rather than created again (D3). Where that column can't be added,
 * a pending row is not created blind: the copy stops with a way to recover.
 */
export async function copyToNotion(repo: Repo, data: InflowData, onProgress?: (done: number, total: number) => void, log: CopyLog = memoryCopyLog()): Promise<CopyResult> {
  const records = data.records.filter((r) => !r.demo)
  const costs = (data.costs ?? []).filter((c) => !c.demo)
  const refunds = (data.refunds ?? []).filter((f) => !f.demo)
  const used = new Set([...records.flatMap((r) => [r.clientId, r.sourceId, r.venueId]), ...costs.flatMap((c) => [c.clientId, c.venueId])])
  const kinds: [EntityKind, Entity[]][] = [['client', data.clients], ['source', data.sources], ['venue', data.venues]]
  const entities = kinds.flatMap(([k, list]) => list.filter((e) => !e.demo || used.has(e.id)).map((e) => [k, e] as const))
  const total = entities.length + records.length + refunds.length + costs.length
  const checks = checksOf(repo)
  const canCheck = checks ? await checks.prepareInflowIds() : false
  let done = 0
  let copied = 0
  let skipped = 0
  let recovered = 0
  /** Writes one row unless it is already in Notion; returns its Notion id. */
  const once = async (kind: CopyKind, sourceId: string, label: string, write: (opts: SaveOptions) => Promise<string>): Promise<string> => {
    const key = `${kind}:${sourceId}`
    const seen = log.get(key)
    if (seen && seen !== PENDING) { skipped++; onProgress?.(++done, total); return seen }
    if (seen === PENDING) {
      if (!checks || !canCheck) {
        throw new CopyUncertain(`"${label}" may already be in Notion: the last copy sent it but never saw Notion's answer. InFlow can't check without an "InFlow ID" column, and couldn't add one. Add a text property named "InFlow ID" to each InFlow database in Notion (or share them with edit access), then copy again. Or look for "${label}" in Notion yourself first.`)
      }
      const found = await checks.findCopied(kind, sourceId)
      if (found) { log.put(key, found); skipped++; recovered++; onProgress?.(++done, total); return found }
    }
    log.put(key, PENDING)
    const id = await write(canCheck ? { inflowId: sourceId } : {})
    log.put(key, id)
    copied++
    onProgress?.(++done, total)
    return id
  }
  const idMap = new Map<string, string>()
  for (const [kind, e] of entities) {
    idMap.set(e.id, await once(kind, e.id, e.name, async (o) => (await repo.saveEntity(kind, { ...e, id: '', demo: undefined }, o)).id))
  }
  const map = (id: string | null) => (id ? idMap.get(id) ?? null : null)
  // Costs before payments, so a reimbursement's link to its cost points at the cost in Notion.
  const costIds = new Map<string, string>()
  for (const c of costs) {
    costIds.set(c.id, await once('cost', c.id, c.description, async (o) => (await repo.saveCost({ ...c, id: '', clientId: map(c.clientId), venueId: map(c.venueId), demo: undefined }, o)).id))
  }
  const recordIds = new Map<string, IncomeRecord>()
  for (const r of records) {
    const copy = { ...r, id: '', clientId: map(r.clientId), sourceId: map(r.sourceId), venueId: map(r.venueId), repaysCostId: r.repaysCostId ? costIds.get(r.repaysCostId) ?? null : r.repaysCostId, demo: undefined }
    const id = await once('record', r.id, r.description, async (o) => (await repo.saveRecord(copy, o)).id)
    recordIds.set(r.id, { ...copy, id })
  }
  for (const f of refunds) {
    const p = recordIds.get(f.paymentId)
    if (!p) { onProgress?.(++done, total); continue }
    await once('refund', f.id, `Refund: ${p.description}`, async (o) => (await repo.saveRefund({ ...f, id: '', paymentId: p.id, demo: undefined }, p, o)).id)
  }
  return { copied, skipped, recovered }
}
