/**
 * The Things client: demo (no token) or live Notion (token + relay), decided
 * per call — same shape as WhereItWent's `lib/notionClient.js`. Local-first:
 * callers should treat every mutation as instant in the UI and let the
 * store's promise resolve/reject in the background (SILVA.md "Data and
 * architecture").
 *
 * Only Paths/embeddings/provocations are out of scope for this session —
 * this store grows a `Paths` counterpart when that build-order step lands,
 * not speculatively now.
 */

import { toThing, toNotionThingProps, patchProps, deriveHandle, type Thing } from './notion'
import { toSource, toNotionSourceProps, patchSourceProps, type Source } from './sources'
import { toLocus, toNotionLocusProps, patchLocusProps, type Locus } from './loci'
import { DEMO_THINGS, DEMO_SOURCES, DEMO_LOCI } from './fixtures'

const PROXY_URL = '/api/notion'

// Recorded here per SILVA.md ("not secrets") — the owner's live databases,
// created in Silva build Session 2. See project_silva-build-plan memory.
export const DEFAULT_SOURCES_DATABASE_ID = '2e675b30-d904-4c25-a62e-cd419b6a2132'
export const DEFAULT_LOCI_DATABASE_ID = '75dd28ce-e739-497e-8bb7-fc212d211255'
export const DEFAULT_THINGS_DATABASE_ID = '83e42291-bbd7-447d-a8e3-eb58221a9b5b'
export const DEFAULT_PATHS_DATABASE_ID = '5d8fcd20-ad7d-4df4-a71a-7d9f29e605c3'

export class SilvaStoreError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'SilvaStoreError'
    this.status = status
  }
}

export interface NewThingInput {
  body: string
  kind?: Thing['kind']
  locator?: string
  note?: string
  link?: string | null
  sourceId?: string | null
  /** Overrides "today" — Kobo import back-dates this to the highlight's own
   *  DateCreated rather than the moment it was imported. */
  encountered?: string
  koboBookmarkId?: string | null
}

export interface NewSourceInput {
  title: string
  author?: string
  kind?: Source['kind']
  koboVolumeId?: string | null
  notes?: string
}

export interface NewLocusInput {
  name: string
  meaning?: string
}

/** A private, session-only copy — demo writes must never mutate the shared
 *  fixture export itself (a second store instance, or a hot reload, would
 *  otherwise see another instance's edits). */
let demoThings: Thing[] = [...DEMO_THINGS]
let demoSources: Source[] = [...DEMO_SOURCES]
let demoLoci: Locus[] = [...DEMO_LOCI]

// Date.now() alone collides when several demo rows are created in the same
// tick — exactly what a Kobo import's per-highlight loop does, caught live
// (React "two children with the same key") rather than by a unit test, since
// no single-item test creates two things fast enough to collide.
let demoIdCounter = 0
function demoId(prefix: string): string {
  demoIdCounter += 1
  return `${prefix}-${Date.now()}-${demoIdCounter}`
}

/** Test-only: reset the in-memory demo store back to the fixtures. */
export function resetDemoThings(): void {
  demoThings = [...DEMO_THINGS]
  demoSources = [...DEMO_SOURCES]
  demoLoci = [...DEMO_LOCI]
}

export class SilvaStore {
  private token: string
  private thingsDbId: string | null
  private sourcesDbId: string | null
  private lociDbId: string | null

  constructor(
    token: string,
    thingsDbId: string | null = DEFAULT_THINGS_DATABASE_ID,
    sourcesDbId: string | null = DEFAULT_SOURCES_DATABASE_ID,
    lociDbId: string | null = DEFAULT_LOCI_DATABASE_ID,
  ) {
    this.token = token
    this.thingsDbId = thingsDbId
    this.sourcesDbId = sourcesDbId
    this.lociDbId = lociDbId
  }

  /** No token → demo. Token but no database id → empty, never a silent mix
   *  of demo rows into a live workspace. */
  private useDemo(): boolean {
    return !this.token
  }

  private async request(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({ path, method, body }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}) as { message?: string })
      throw new SilvaStoreError(payload.message || `Notion API error ${res.status}`, res.status)
    }
    return res.json().catch(() => ({}))
  }

  private async fetchAllPages(dbId: string): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = []
    let cursor: string | undefined
    do {
      const body: Record<string, unknown> = { page_size: 100 }
      if (cursor) body.start_cursor = cursor
      const data = await this.request(`databases/${dbId}/query`, 'POST', body)
      all.push(...((data.results as Record<string, unknown>[]) || []))
      cursor = data.has_more ? (data.next_cursor as string) : undefined
    } while (cursor)
    return all
  }

  async listThings(): Promise<Thing[]> {
    if (this.useDemo()) return [...demoThings]
    if (!this.thingsDbId) return []
    const pages = await this.fetchAllPages(this.thingsDbId)
    return pages.map((page) => toThing(page as { id: string; properties: Record<string, unknown> }))
  }

  async createThing(input: NewThingInput): Promise<Thing> {
    const now = new Date().toISOString().slice(0, 10)
    const draft: Omit<Thing, 'id'> = {
      handle: deriveHandle(input.body),
      body: input.body,
      kind: input.kind ?? null,
      state: 'Understory',
      sourceId: input.sourceId ?? null,
      locator: input.locator ?? '',
      encountered: input.encountered ?? now,
      kept: null,
      note: input.note ?? '',
      lociIds: [],
      image: null,
      link: input.link ?? null,
      koboBookmarkId: input.koboBookmarkId ?? null,
    }

    if (this.useDemo()) {
      const thing: Thing = { ...draft, id: demoId('demo-thing') }
      demoThings = [thing, ...demoThings]
      return thing
    }

    if (!this.thingsDbId) {
      throw new SilvaStoreError('No Things database configured.', 0)
    }

    const page = await this.request('pages', 'POST', {
      parent: { database_id: this.thingsDbId },
      properties: toNotionThingProps(draft),
    })
    return toThing(page as { id: string; properties: Record<string, unknown> })
  }

  async updateThing(id: string, patch: Partial<Thing>): Promise<Thing> {
    if (this.useDemo()) {
      let updated: Thing | undefined
      demoThings = demoThings.map((thing) => {
        if (thing.id !== id) return thing
        updated = { ...thing, ...patch }
        return updated
      })
      if (!updated) throw new SilvaStoreError(`No such thing: ${id}`, 404)
      return updated
    }

    const properties = patchProps(patch)
    const page = await this.request(`pages/${id}`, 'PATCH', { properties })
    return toThing(page as { id: string; properties: Record<string, unknown> })
  }

  async listSources(): Promise<Source[]> {
    if (this.useDemo()) return [...demoSources]
    if (!this.sourcesDbId) return []
    const pages = await this.fetchAllPages(this.sourcesDbId)
    return pages.map((page) => toSource(page as { id: string; properties: Record<string, unknown> }))
  }

  async createSource(input: NewSourceInput): Promise<Source> {
    const draft: Omit<Source, 'id'> = {
      title: input.title,
      author: input.author ?? '',
      kind: input.kind ?? null,
      cover: null,
      koboVolumeId: input.koboVolumeId ?? null,
      notes: input.notes ?? '',
    }

    if (this.useDemo()) {
      const source: Source = { ...draft, id: demoId('demo-source') }
      demoSources = [source, ...demoSources]
      return source
    }

    if (!this.sourcesDbId) {
      throw new SilvaStoreError('No Sources database configured.', 0)
    }

    const page = await this.request('pages', 'POST', {
      parent: { database_id: this.sourcesDbId },
      properties: toNotionSourceProps(draft),
    })
    return toSource(page as { id: string; properties: Record<string, unknown> })
  }

  /** Used to backfill `koboVolumeId` onto a Source matched by fuzzy title
   *  similarity, so a later re-import of the same book hits the exact-match
   *  tier instead (see lib/bookMatch.ts). */
  async updateSource(id: string, patch: Partial<Source>): Promise<Source> {
    if (this.useDemo()) {
      let updated: Source | undefined
      demoSources = demoSources.map((source) => {
        if (source.id !== id) return source
        updated = { ...source, ...patch }
        return updated
      })
      if (!updated) throw new SilvaStoreError(`No such source: ${id}`, 404)
      return updated
    }

    const properties = patchSourceProps(patch)
    const page = await this.request(`pages/${id}`, 'PATCH', { properties })
    return toSource(page as { id: string; properties: Record<string, unknown> })
  }

  async listLoci(): Promise<Locus[]> {
    if (this.useDemo()) return [...demoLoci]
    if (!this.lociDbId) return []
    const pages = await this.fetchAllPages(this.lociDbId)
    return pages.map((page) => toLocus(page as { id: string; properties: Record<string, unknown> }))
  }

  /** Coining is always retrospective — `coined` defaults to today and isn't
   *  a caller-supplied field (SILVA.md: "named after the things, never
   *  before them"). */
  async createLocus(input: NewLocusInput): Promise<Locus> {
    const draft: Omit<Locus, 'id'> = {
      name: input.name,
      meaning: input.meaning ?? '',
      coined: new Date().toISOString().slice(0, 10),
    }

    if (this.useDemo()) {
      const locus: Locus = { ...draft, id: demoId('demo-locus') }
      demoLoci = [locus, ...demoLoci]
      return locus
    }

    if (!this.lociDbId) {
      throw new SilvaStoreError('No Loci database configured.', 0)
    }

    const page = await this.request('pages', 'POST', {
      parent: { database_id: this.lociDbId },
      properties: toNotionLocusProps(draft),
    })
    return toLocus(page as { id: string; properties: Record<string, unknown> })
  }

  async updateLocus(id: string, patch: Partial<Locus>): Promise<Locus> {
    if (this.useDemo()) {
      let updated: Locus | undefined
      demoLoci = demoLoci.map((locus) => {
        if (locus.id !== id) return locus
        updated = { ...locus, ...patch }
        return updated
      })
      if (!updated) throw new SilvaStoreError(`No such locus: ${id}`, 404)
      return updated
    }

    const properties = patchLocusProps(patch)
    const page = await this.request(`pages/${id}`, 'PATCH', { properties })
    return toLocus(page as { id: string; properties: Record<string, unknown> })
  }

  /** Notion's reversible "delete" (archived: true, same convention every
   *  app in this repo uses — see e.g. WhereItWent's notionClient.js).
   *  Callers must strip the id from any Thing's `lociIds` themselves first
   *  (lib/loci.ts's `withoutLocus` helper) — this only removes the locus
   *  record, since membership lives on the Things side. */
  async archiveLocus(id: string): Promise<void> {
    if (this.useDemo()) {
      demoLoci = demoLoci.filter((locus) => locus.id !== id)
      return
    }

    if (!this.lociDbId) {
      throw new SilvaStoreError('No Loci database configured.', 0)
    }

    await this.request(`pages/${id}`, 'PATCH', { archived: true })
  }
}
