/**
 * The storage seam. The app talks to a `Repo`; on this device it is the
 * IndexedDB-backed `DeviceRepo`, with Notion connected it is `NotionRepo`
 * (store/notion.ts). Both hand back whole `InflowData` on load and the saved
 * entity (with its final id) on every write.
 */
import type { KeyValueStore } from '../../shared/kvStore'
import type { Client, CostRecord, IncomeRecord, InflowData, Source, Venue } from '../domain/types'

export type EntityKind = 'client' | 'source' | 'venue'
export type Entity = Client | Source | Venue

export interface Repo {
  readonly kind: 'device' | 'notion'
  load(): Promise<InflowData>
  saveRecord(r: IncomeRecord): Promise<IncomeRecord>
  deleteRecord(id: string): Promise<void>
  saveCost(c: CostRecord): Promise<CostRecord>
  deleteCost(id: string): Promise<void>
  saveEntity<T extends Entity>(kind: EntityKind, e: T): Promise<T>
  deleteEntity(kind: EntityKind, id: string): Promise<void>
}

export const EMPTY: InflowData = { records: [], costs: [], clients: [], sources: [], venues: [] }

export const DATA_KEY = 'data'
/** The demo practice lives under its own key, never mixed with your data. */
export const DEMO_KEY = 'demo'

/**
 * Data saved by an older InFlow, filled in: costs arrived after income, venue
 * deals and head counts after costs. Missing means "none" / "not recorded".
 */
export function normalise(stored: Partial<InflowData> | undefined | null): InflowData {
  const d = { ...EMPTY, ...(stored ?? {}) }
  return {
    ...d,
    costs: d.costs ?? [],
    records: (d.records ?? []).map((r) => ({ ...r, attendees: r.attendees ?? null, sessions: r.sessions && r.sessions > 0 ? r.sessions : 1, hours: r.hours ?? null })),
    venues: (d.venues ?? []).map((v) => ({ ...v, deal: v.deal ?? 'none', feePerSession: v.feePerSession ?? 0, sharePct: v.sharePct ?? 0, monthlyFee: v.monthlyFee ?? 0 })),
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

/** Everything on this device, in one IndexedDB value written as a whole. */
export class DeviceRepo implements Repo {
  readonly kind = 'device' as const
  private data: InflowData = EMPTY
  constructor(private store: KeyValueStore, private key: string = DATA_KEY) {}

  async load(): Promise<InflowData> {
    const stored = await this.store.get<InflowData>(this.key)
    this.data = normalise(stored)
    return this.data
  }

  async replaceAll(data: InflowData): Promise<void> {
    this.data = data
    await this.store.set(this.key, data)
  }

  private async commit(next: InflowData) {
    await this.store.set(this.key, next)
    this.data = next
  }

  async saveRecord(r: IncomeRecord): Promise<IncomeRecord> {
    const saved = r.id ? r : { ...r, id: newId() }
    await this.commit({ ...this.data, records: upsert(this.data.records, saved) })
    return saved
  }

  async deleteRecord(id: string): Promise<void> {
    await this.commit({ ...this.data, records: this.data.records.filter((r) => r.id !== id) })
  }

  async saveCost(c: CostRecord): Promise<CostRecord> {
    const saved = c.id ? c : { ...c, id: newId() }
    await this.commit({ ...this.data, costs: upsert(this.data.costs, saved) })
    return saved
  }

  async deleteCost(id: string): Promise<void> {
    await this.commit({ ...this.data, costs: this.data.costs.filter((c) => c.id !== id) })
  }

  async saveEntity<T extends Entity>(kind: EntityKind, e: T): Promise<T> {
    const saved = e.id ? e : { ...e, id: newId() }
    const key = listKey(kind)
    await this.commit({ ...this.data, [key]: upsert(this.data[key] as Entity[], saved) })
    return saved
  }

  async deleteEntity(kind: EntityKind, id: string): Promise<void> {
    const key = listKey(kind)
    const field = kind === 'client' ? 'clientId' : kind === 'source' ? 'sourceId' : 'venueId'
    await this.commit({
      ...this.data,
      [key]: (this.data[key] as Entity[]).filter((x) => x.id !== id),
      // Records keep their history; the link is simply cleared.
      records: this.data.records.map((r) => (r[field] === id ? { ...r, [field]: null } : r)),
      costs: this.data.costs.map((c) => (field !== 'sourceId' && c[field as 'clientId' | 'venueId'] === id ? { ...c, [field]: null } : c)),
    })
  }
}
