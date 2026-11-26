/**
 * Import history (Release 2, experimental): the batches, the ledger of every transaction key an
 * import has decided, the saved rules and your own account names. One per data set (the demo,
 * this device, a Notion workspace), kept on this device in the same IndexedDB as the data, and in
 * device backups.
 *
 * The ledger is a convenience, not the source of truth for "already imported": every created or
 * linked record carries its key in `importMeta` (stored in Notion's "Import" column too), so a
 * second device, a restore or a lost ledger still finds what is in InFlow.
 */
import type { KeyValueStore } from '../../shared/kvStore'
import type { ImportMeta, IncomeRecord } from '../domain/types'
import type { Kind, LedgerEntry, Rule } from '../lib/import/classify'

export const IMPORT_VERSION = 1
export const importKey = (scope: string) => `import:${scope}`

export type Held = 'record' | 'cost' | 'refund'

export interface Batch {
  id: string
  /** ISO timestamp of the import. */
  at: string
  /** About the file, never its contents: the name you picked, its date range and row count. */
  file: { name: string; rows: number; from: string | null; to: string | null; currencies: string[] }
  status: 'running' | 'done' | 'undone'
  /** What this import made, with a stamp of each as saved, to tell later edits apart. */
  created: { kind: Held; id: string; key: string; stamp: string }[]
  /** Existing entries it marked as these transactions, with what they carried before. */
  linked: { kind: Held; id: string; key: string; before: ImportMeta | null }[]
  /** Expected payments it marked received: the payment as it was, to put back on undo. */
  received: { key: string; expectedId: string; receivedId: string; before: IncomeRecord; stamp: string; part: boolean }[]
  setAside: number
  /** Clients made during the review; undo keeps them and says so. */
  clients: string[]
  undoneAt?: string
}

export interface ImportState {
  version: number
  batches: Batch[]
  ledger: Record<string, LedgerEntry & { kind: Kind }>
  rules: Rule[]
  ownNames: string[]
}

export const EMPTY_IMPORTS: ImportState = { version: IMPORT_VERSION, batches: [], ledger: {}, rules: [], ownNames: [] }

/** Reads stored import history, tolerating anything missing or damaged (it is a convenience). */
export function normaliseImports(raw: unknown): ImportState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ImportState>
  return {
    version: IMPORT_VERSION,
    batches: Array.isArray(r.batches) ? r.batches.filter((b) => b && typeof b.id === 'string') : [],
    ledger: r.ledger && typeof r.ledger === 'object' && !Array.isArray(r.ledger) ? r.ledger : {},
    rules: Array.isArray(r.rules) ? r.rules.filter((x) => x && typeof x.id === 'string' && typeof x.value === 'string') : [],
    ownNames: Array.isArray(r.ownNames) ? r.ownNames.filter((x) => typeof x === 'string') : [],
  }
}

export async function loadImports(store: KeyValueStore, key: string): Promise<ImportState> {
  return normaliseImports(await store.get(key))
}

/** Changes import history in one transaction, so two tabs never overwrite each other. */
export function updateImports(store: KeyValueStore, key: string, fn: (s: ImportState) => ImportState): Promise<ImportState> {
  return store.update<ImportState>(key, (cur) => fn(normaliseImports(cur)))
}

/** A stable stamp of a saved entry, to see later whether it was edited. Ignores fields the app adds on load. */
export function stamp(x: object): string {
  const { id: _id, ...rest } = x as Record<string, unknown>
  const keys = Object.keys(rest).filter((k) => rest[k] !== undefined && k !== 'dealTerms' && k !== 'demo').sort()
  return JSON.stringify(keys.map((k) => [k, rest[k]]))
}
