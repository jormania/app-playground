/**
 * The storage seam. The app talks to a `Repo`; on this device it is the
 * IndexedDB-backed `DeviceRepo`, with Notion connected it is `NotionRepo`
 * (store/notion.ts). Both hand back whole `InflowData` on load and the saved
 * entity (with its final id) on every write.
 */
import type { KeyValueStore } from '../../shared/kvStore'
import type { Client, CostRecord, IncomeRecord, InflowData, Refund, Source, Venue } from '../domain/types'
import { termsOf } from '../lib/deals'

export type EntityKind = 'client' | 'source' | 'venue'
export type Entity = Client | Source | Venue

export interface Repo {
  readonly kind: 'device' | 'notion'
  load(): Promise<InflowData>
  /** `opts.inflowId`: the copy to Notion's device id for the row (NotionRepo only). */
  saveRecord(r: IncomeRecord, opts?: { inflowId?: string }): Promise<IncomeRecord>
  /** `refundIds`: the payment's refunds, removed with it. */
  deleteRecord(id: string, refundIds?: string[]): Promise<void>
  saveCost(c: CostRecord, opts?: { inflowId?: string }): Promise<CostRecord>
  deleteCost(id: string): Promise<void>
  saveEntity<T extends Entity>(kind: EntityKind, e: T, opts?: { inflowId?: string }): Promise<T>
  deleteEntity(kind: EntityKind, id: string): Promise<void>
  /** `payment`: the payment refunded, as loaded (Notion names the row after it). */
  saveRefund(f: Refund, payment?: IncomeRecord, opts?: { inflowId?: string }): Promise<Refund>
  deleteRefund(id: string): Promise<void>
}

/** The shape device data is written in now. 2: each payment snapshots its venue's deal. */
export const SCHEMA = 2

export const EMPTY: InflowData = { records: [], costs: [], clients: [], sources: [], venues: [], refunds: [], schema: SCHEMA }

export const DATA_KEY = 'data'
/** The demo practice lives under its own key, never mixed with your data. */
export const DEMO_KEY = 'demo'

/**
 * Data saved by an older InFlow, filled in: costs arrived after income, venue
 * deals and head counts after costs, refunds after that. Missing means "none" / "not recorded".
 *
 * Versioned migrations (`schema`), each run once, in order, on data older than it:
 *
 *   2  Each payment at a venue gets `dealTerms`, the deal it is counted under from now on. What
 *      the deal was when an old payment was made was never recorded, so the venue's terms as
 *      stored at migration are used: every figure stays exactly as it was the moment before,
 *      and later edits to the venue no longer reach back. Nothing is invented.
 */
export function normalise(stored: Partial<InflowData> | undefined | null): InflowData {
  const d = { ...EMPTY, ...(stored ?? {}) }
  const version = stored ? stored.schema ?? 1 : SCHEMA
  const venues = (d.venues ?? []).map((v) => ({ ...v, deal: v.deal ?? 'none', feePerSession: v.feePerSession ?? 0, sharePct: v.sharePct ?? 0, monthlyFee: v.monthlyFee ?? 0 }))
  let records = (d.records ?? []).map((r) => ({ ...r, attendees: r.attendees ?? null, sessions: typeof r.sessions === 'number' && r.sessions >= 0 ? r.sessions : 1, hours: r.hours ?? null }))
  if (version < 2) {
    const byId = new Map(venues.map((v) => [v.id, v]))
    records = records.map((r) => {
      if (r.dealTerms !== undefined) return r
      const v = r.venueId ? byId.get(r.venueId) : undefined
      return { ...r, dealTerms: v ? termsOf(v) : null }
    })
  }
  return {
    ...d,
    costs: d.costs ?? [],
    records,
    venues,
    refunds: d.refunds ?? [],
    schema: Math.max(version, SCHEMA),
  }
}

export function newId(prefix = 'loc'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18)
  return `${prefix}_${rnd}`
}

export function isLocalId(id: string): boolean {
  return /^(loc|demo)_/.test(id)
}

export function listKey(kind: EntityKind): 'clients' | 'sources' | 'venues' {
  return kind === 'client' ? 'clients' : kind === 'source' ? 'sources' : 'venues'
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}

/** Tells other open tabs of InFlow that this device's data changed (see `DeviceRepo`). */
export const DATA_CHANNEL = 'inflow-data'
/** This tab, so it can ignore its own change notices. */
export const TAB_ID = newId('tab')

export interface DataChange { tab: string; key: string }

function announce(key: string) {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const ch = new BroadcastChannel(DATA_CHANNEL)
    ch.postMessage({ tab: TAB_ID, key } satisfies DataChange)
    ch.close()
  } catch { /* another tab will see the change on its next load */ }
}

/**
 * Everything on this device, in one IndexedDB value.
 *
 * Every write is a change applied to what is stored *at that moment*, read and written in one
 * transaction (`store.update`), never this tab's in-memory copy written over it. Two tabs open
 * at once, or the installed app beside a browser tab, therefore each keep the other's records
 * (audit A-01). After a write the other tabs are told to reload (`DATA_CHANNEL`).
 */
export class DeviceRepo implements Repo {
  readonly kind = 'device' as const
  private data: InflowData = EMPTY
  constructor(private store: KeyValueStore, private key: string = DATA_KEY) {}

  async load(): Promise<InflowData> {
    const stored = await this.store.get<InflowData>(this.key)
    // Older data is migrated once and written back, in one transaction with whatever is stored then.
    if (stored && (stored.schema ?? 1) < SCHEMA) return this.mutate((d) => d)
    this.data = normalise(stored)
    return this.data
  }

  async replaceAll(data: InflowData): Promise<void> {
    await this.store.set(this.key, data)
    this.data = data
    announce(this.key)
  }

  /** The stored data, normalised, changed by `fn` and written back in one transaction. */
  private async mutate(fn: (d: InflowData) => InflowData): Promise<InflowData> {
    const next = await this.store.update<InflowData>(this.key, (cur) => fn(normalise(cur)))
    this.data = next
    announce(this.key)
    return next
  }

  async saveRecord(r: IncomeRecord): Promise<IncomeRecord> {
    const saved = r.id ? r : { ...r, id: newId() }
    await this.mutate((d) => ({ ...d, records: upsert(d.records, saved) }))
    return saved
  }

  /** A payment goes with its refunds: they mean nothing without it. */
  async deleteRecord(id: string): Promise<void> {
    await this.mutate((d) => ({ ...d, records: d.records.filter((r) => r.id !== id), refunds: d.refunds.filter((f) => f.paymentId !== id) }))
  }

  async saveRefund(f: Refund): Promise<Refund> {
    const saved = f.id ? f : { ...f, id: newId() }
    await this.mutate((d) => ({ ...d, refunds: upsert(d.refunds, saved) }))
    return saved
  }

  async deleteRefund(id: string): Promise<void> {
    await this.mutate((d) => ({ ...d, refunds: d.refunds.filter((f) => f.id !== id) }))
  }

  async saveCost(c: CostRecord): Promise<CostRecord> {
    const saved = c.id ? c : { ...c, id: newId() }
    await this.mutate((d) => ({ ...d, costs: upsert(d.costs, saved) }))
    return saved
  }

  async deleteCost(id: string): Promise<void> {
    await this.mutate((d) => ({ ...d, costs: d.costs.filter((c) => c.id !== id) }))
  }

  async saveEntity<T extends Entity>(kind: EntityKind, e: T): Promise<T> {
    const saved = e.id ? e : { ...e, id: newId() }
    const key = listKey(kind)
    await this.mutate((d) => ({ ...d, [key]: upsert(d[key] as Entity[], saved) }))
    return saved
  }

  async deleteEntity(kind: EntityKind, id: string): Promise<void> {
    const key = listKey(kind)
    const field = kind === 'client' ? 'clientId' : kind === 'source' ? 'sourceId' : 'venueId'
    await this.mutate((d) => ({
      ...d,
      [key]: (d[key] as Entity[]).filter((x) => x.id !== id),
      // Records keep their history; the link is simply cleared.
      records: d.records.map((r) => (r[field] === id ? { ...r, [field]: null } : r)),
      costs: d.costs.map((c) => (field !== 'sourceId' && c[field as 'clientId' | 'venueId'] === id ? { ...c, [field]: null } : c)),
    }))
  }
}
