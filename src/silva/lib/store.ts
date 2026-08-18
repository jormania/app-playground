/**
 * The Things client: demo (no token) or live Notion (token + relay), decided
 * per call — same shape as WhereItWent's `lib/notionClient.js`. Local-first:
 * callers should treat every mutation as instant in the UI and let the
 * store's promise resolve/reject in the background (SILVA.md "Data and
 * architecture").
 *
 * Only Loci/Paths/embeddings/provocations are out of scope for this session
 * — this store grows a `Loci`/`Paths` counterpart when those build-order
 * steps land, not speculatively now.
 */

import { toThing, toNotionThingProps, patchProps, deriveHandle, type Thing } from './notion'
import { DEMO_THINGS } from './fixtures'

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
}

/** A private, session-only copy — demo writes must never mutate the shared
 *  fixture export itself (a second store instance, or a hot reload, would
 *  otherwise see another instance's edits). */
let demoThings: Thing[] = [...DEMO_THINGS]

/** Test-only: reset the in-memory demo store back to the fixtures. */
export function resetDemoThings(): void {
  demoThings = [...DEMO_THINGS]
}

export class SilvaStore {
  private token: string
  private thingsDbId: string | null

  constructor(token: string, thingsDbId: string | null = DEFAULT_THINGS_DATABASE_ID) {
    this.token = token
    this.thingsDbId = thingsDbId
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
      sourceId: null,
      locator: input.locator ?? '',
      encountered: now,
      kept: null,
      note: input.note ?? '',
      lociIds: [],
      image: null,
      link: input.link ?? null,
      koboBookmarkId: null,
    }

    if (this.useDemo()) {
      const thing: Thing = { ...draft, id: `demo-thing-${Date.now()}` }
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
}
