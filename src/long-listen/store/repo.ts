import { createStore, del, entries, get, keys, set, setMany } from 'idb-keyval'
import { normalisePreferences } from '../domain/types'
import type {
  ListenerPreferences,
  Album, Artist, Comparison, Concert, Explanation, Feedback, ListeningEvent, NotionSyncState, Programme,
  ProgrammeOption, Recording, Resource, TasteProfile, Theme, ThemeExploration, WeekRecord, Work,
} from '../domain/types'

/**
 * The Long Listen's primary database: IndexedDB on this device, in a database of
 * its own (`long-listen`), one record per entity under a typed key. Notion is a
 * human-readable mirror of part of this (notion/mirror.ts), never the source.
 *
 * Same seam as KeyPath's store.ts: an interface, so tests run on memory.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  setMany(pairs: [string, unknown][]): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
  entries(): Promise<[string, unknown][]>
}

export function indexedDbStore(): KeyValueStore {
  const db = createStore('long-listen', 'records')
  return {
    get: (key) => get(key, db),
    set: (key, value) => set(key, value, db),
    setMany: (pairs) => setMany(pairs, db),
    del: (key) => del(key, db),
    keys: async () => (await keys(db)).map(String),
    entries: async () => (await entries(db)).map(([k, v]) => [String(k), v] as [string, unknown]),
  }
}

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const m = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T,>(key: string) => structuredClone(m.get(key)) as T | undefined,
    set: async (key, value) => void m.set(key, structuredClone(value)),
    setMany: async (pairs) => { for (const [k, v] of pairs) m.set(k, structuredClone(v)) },
    del: async (key) => void m.delete(key),
    keys: async () => [...m.keys()],
    entries: async () => [...m.entries()].map(([k, v]) => [k, structuredClone(v)] as [string, unknown]),
  }
}

export const PREFIX = 'll:v1:'

export class Collection<T> {
  constructor(
    private readonly store: KeyValueStore,
    readonly name: string,
    private readonly keyOf: (value: T) => string,
  ) {}

  private key(id: string) {
    return `${PREFIX}${this.name}:${id}`
  }

  get(id: string): Promise<T | undefined> {
    return this.store.get<T>(this.key(id))
  }

  async require(id: string): Promise<T> {
    const v = await this.get(id)
    if (v === undefined) throw new Error(`${this.name} ${id} is missing`)
    return v
  }

  put(value: T): Promise<void> {
    return this.store.set(this.key(this.keyOf(value)), value)
  }

  putMany(values: T[]): Promise<void> {
    return this.store.setMany(values.map((v) => [this.key(this.keyOf(v)), v]))
  }

  delete(id: string): Promise<void> {
    return this.store.del(this.key(id))
  }

  async all(): Promise<T[]> {
    const prefix = `${PREFIX}${this.name}:`
    const rows = await this.store.entries()
    return rows.filter(([k]) => k.startsWith(prefix)).map(([, v]) => v as T)
  }

  async many(ids: string[]): Promise<T[]> {
    const got: (T | undefined)[] = await Promise.all(ids.map((id) => this.get(id)))
    return got.filter((v): v is T => v !== undefined)
  }
}

const SINGLETON = {
  taste: `${PREFIX}singleton:taste`,
  preferences: `${PREFIX}singleton:preferences`,
  meta: `${PREFIX}singleton:meta`,
}

export interface Mark {
  id: string
  at: string
  value?: unknown
}

export interface Meta {
  /** Schema version of what's stored, for future migrations. */
  schema: 1
  createdAt: string
}

export const EMPTY_TASTE: TasteProfile = { observations: [], questions: [], notesToCurator: '', updatedAt: '' }

/**
 * Everything the app keeps, by collection. Every screen and service goes
 * through one of these rather than the raw store.
 */
export class Repo {
  readonly themes: Collection<Theme>
  readonly explorations: Collection<ThemeExploration>
  readonly weeks: Collection<WeekRecord>
  readonly options: Collection<ProgrammeOption>
  readonly programmes: Collection<Programme>
  readonly comparisons: Collection<Comparison>
  readonly works: Collection<Work>
  readonly recordings: Collection<Recording>
  readonly albums: Collection<Album>
  readonly artists: Collection<Artist>
  readonly events: Collection<ListeningEvent>
  readonly feedback: Collection<Feedback>
  readonly resources: Collection<Resource>
  readonly explanations: Collection<Explanation>
  readonly notion: Collection<NotionSyncState>
  /** Small facts with no entity of their own: "resources searched for prog_x". */
  readonly marks: Collection<Mark>
  readonly concerts: Collection<Concert>

  /**
   * Which journey this is: bumped by a fresh start. A curator call takes a
   * minute; anything that read the journey before a fresh start and answers
   * after it must not write the old journey back into the cleared store, so
   * Journey compares this before and after each call. Per page, in memory —
   * a fresh start is made from this page.
   */
  private epoch = 0
  get generation(): number {
    return this.epoch
  }

  constructor(readonly store: KeyValueStore) {
    const c = <T,>(name: string, keyOf: (v: T) => string) => new Collection<T>(store, name, keyOf)
    this.themes = c('theme', (v) => v.id)
    this.explorations = c('exploration', (v) => v.id)
    this.weeks = c('week', (v) => v.weekKey)
    this.options = c('option', (v) => v.id)
    this.programmes = c('programme', (v) => v.id)
    this.comparisons = c('comparison', (v) => v.id)
    this.works = c('work', (v) => v.id)
    this.recordings = c('recording', (v) => v.id)
    this.albums = c('album', (v) => v.id)
    this.artists = c('artist', (v) => v.id)
    this.events = c('event', (v) => v.id)
    this.feedback = c('feedback', (v) => v.id)
    this.resources = c('resource', (v) => v.id)
    this.explanations = c('explanation', (v) => v.id)
    this.notion = c('notion', (v) => v.key)
    this.marks = c('mark', (v) => v.id)
    this.concerts = c('concert', (v) => v.id)
  }

  async taste(): Promise<TasteProfile> {
    return (await this.store.get<TasteProfile>(SINGLETON.taste)) ?? structuredClone(EMPTY_TASTE)
  }

  saveTaste(profile: TasteProfile): Promise<void> {
    return this.store.set(SINGLETON.taste, profile)
  }

  async preferences(): Promise<ListenerPreferences> {
    return normalisePreferences(await this.store.get<Partial<ListenerPreferences>>(SINGLETON.preferences))
  }

  savePreferences(p: ListenerPreferences): Promise<void> {
    return this.store.set(SINGLETON.preferences, p)
  }

  /** Programmes are snapshots: once written, never overwritten. */
  async addProgramme(p: Programme): Promise<void> {
    if (await this.programmes.get(p.id)) throw new Error(`Programme ${p.id} already exists — programmes are immutable`)
    await this.programmes.put(p)
  }

  async ensureMeta(now: string): Promise<Meta> {
    const m = await this.store.get<Meta>(SINGLETON.meta)
    if (m) return m
    const fresh: Meta = { schema: 1, createdAt: now }
    await this.store.set(SINGLETON.meta, fresh)
    return fresh
  }

  /** Every record, for a one-file backup. */
  async exportAll(): Promise<{ app: 'the-long-listen'; version: 1; exportedAt: string; records: Record<string, unknown> }> {
    const rows = await this.store.entries()
    return {
      app: 'the-long-listen',
      version: 1,
      exportedAt: new Date().toISOString(),
      records: Object.fromEntries(rows.filter(([k]) => k.startsWith(PREFIX))),
    }
  }

  /**
   * A fresh start: forget the whole journey — weeks, programmes, threads,
   * listening, feedback, what the curator learned about the listener — and
   * keep only what the listener set up: their music & exploration
   * preferences, and the Notion notebook's location (so its databases are
   * reused, not duplicated). Credentials and appearance live in this
   * device's settings, outside the store, and are untouched.
   */
  async freshStart(): Promise<void> {
    // First, so a curator call already in flight sees it the moment it answers.
    this.epoch++
    const prefs = await this.preferences()
    const setup = await this.marks.get('notion:setup')
    for (const k of await this.store.keys()) if (k.startsWith(PREFIX)) await this.store.del(k)
    await this.savePreferences({ ...prefs, nextRequest: '' })
    if (setup) await this.marks.put(setup)
  }

  /** Restore a backup. Adds and overwrites; never deletes what the backup lacks. */
  async importAll(backup: unknown): Promise<number> {
    const b = backup as { app?: string; records?: Record<string, unknown> }
    if (b?.app !== 'the-long-listen' || !b.records || typeof b.records !== 'object') {
      throw new Error('That file is not a Long Listen backup.')
    }
    const pairs = Object.entries(b.records).filter(([k]) => k.startsWith(PREFIX))
    await this.store.setMany(pairs)
    return pairs.length
  }
}
