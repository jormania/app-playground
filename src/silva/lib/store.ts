/**
 * The Things client: demo (no token) or live Notion (token + relay), decided
 * per call — same shape as WhereItWent's `lib/notionClient.js`. Local-first:
 * callers should treat every mutation as instant in the UI and let the
 * store's promise resolve/reject in the background (SILVA.md "Data and
 * architecture").
 *
 * Only embeddings/provocations are out of scope for this session — this
 * store grows whatever those build-order steps need, not speculatively now.
 */

import { toThing, toNotionThingProps, patchProps, deriveHandle, type Thing } from './notion'
import { todayIso } from './understory'
import { toSource, toNotionSourceProps, patchSourceProps, type Source } from './sources'
import { toLocus, toNotionLocusProps, patchLocusProps, type Locus } from './loci'
import { toPath, toNotionPathProps, patchPathProps, deriveLabel, type Path } from './paths'
import { DEMO_THINGS, DEMO_SOURCES, DEMO_LOCI, DEMO_PATHS } from './fixtures'
import { readJson, writeJson, removeJson } from '../../shared/storage'
import { createRequestQueue, type Enqueue } from './requestQueue'

const PROXY_URL = '/api/notion'

/** One queue for the whole module, not one per store: the limits it exists
 *  to respect are per-IP, so two SilvaStore instances (a live one and the
 *  one Settings builds to test a connection) must share a single budget. */
const notionQueue: Enqueue = createRequestQueue()
// Notion's file-upload endpoints postdate the classic 2022-06-28 version the
// rest of Silva is pinned to. api/notion.js allows this one explicitly; only
// the upload calls below pass it.
const NOTION_FILES_VERSION = '2025-09-03'
const UPLOAD_URL = '/api/notion-upload'

// Recorded here per SILVA.md ("not secrets") — the owner's live databases,
// created in Silva build Session 2. See project_silva-build-plan memory.
//
// These are the DATABASE ids (the container Notion object), not the DATA
// SOURCE ids inside them — Notion split the two apart, and the classic API
// version this app is pinned to (Notion-Version 2022-06-28,
// `databases/{id}` and `databases/{id}/query`) needs the container id.
// A data-source id looks identical (same UUID shape) but 404s here with
// "Could not find database with ID" — that was a real bug, not a sharing
// problem: these four constants originally held the data-source ids.
export const DEFAULT_SOURCES_DATABASE_ID = '9b78aa55-b216-4565-b924-2bc68b2b083b'
export const DEFAULT_LOCI_DATABASE_ID = '8483aa21-cf08-4203-b32d-8cc2ab8a87f3'
export const DEFAULT_THINGS_DATABASE_ID = 'cf9d0865-e425-4928-ae8b-a7896e31dac1'
export const DEFAULT_PATHS_DATABASE_ID = '4cda3453-8ca0-407b-aa70-f08410b4b79b'

export class SilvaStoreError extends Error {
  status: number
  /** From a 429's `Retry-After`, when the server named one — read by
   *  lib/requestQueue.ts's backoff rather than guessing. */
  retryAfterMs?: number
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message)
    this.name = 'SilvaStoreError'
    this.status = status
    this.retryAfterMs = retryAfterMs
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
  /** A local photo reference (lib/photoStore.ts) for a demo-forest photograph.
   *  Live things get their image from `uploadPhoto`/`attachPhoto` instead —
   *  Notion's files property can't be written through `patchProps`. */
  image?: string | null
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

export interface NewPathInput {
  fromId: string
  toId: string
  fromHandle: string
  toHandle: string
  why: string
  /** Defaults to 'Yours' — pass 'Accepted' only when this path is being
   *  created from accepting a provocation (SILVA.md: "Accepted (you
   *  accepted a provocation)" — never any other way). */
  origin?: Path['origin']
}

/**
 * The demo forest lives in localStorage, not just in memory — SILVA.md:
 * "No token -> the demo store — a full offline forest in `localStorage`,
 * seeded once from `lib/fixtures.js`". Seeded once, then owned by the user:
 * something typed into the demo forest survives a reload, which is the whole
 * point of "the whole app is usable before you create a single database."
 *
 * The module-level copies below stay the read path (demo reads must not
 * re-parse JSON on every call); `persistDemo` mirrors each write out to
 * localStorage, and `hydrateDemo` runs once at module load. Storage is via
 * shared/storage, which can't throw — a browser that refuses to persist
 * simply falls back to the old in-memory behaviour rather than crashing.
 */
const DEMO_KEY = 'silva:demo-forest'
const DEMO_SEED_VERSION = 1

interface DemoSnapshot {
  version: number
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  paths: Path[]
}

let demoThings: Thing[] = [...DEMO_THINGS]
let demoSources: Source[] = [...DEMO_SOURCES]
let demoLoci: Locus[] = [...DEMO_LOCI]
let demoPaths: Path[] = [...DEMO_PATHS]

function persistDemo(): void {
  writeJson(DEMO_KEY, {
    version: DEMO_SEED_VERSION,
    things: demoThings,
    sources: demoSources,
    loci: demoLoci,
    paths: demoPaths,
  } satisfies DemoSnapshot)
}

function hydrateDemo(): void {
  const stored = readJson<DemoSnapshot | null>(DEMO_KEY, null)
  // A snapshot from an older seed version is discarded rather than migrated —
  // it's a demo, and re-seeding it is strictly better than showing a forest
  // half of whose fixtures no longer exist.
  if (!stored || stored.version !== DEMO_SEED_VERSION || !Array.isArray(stored.things)) {
    persistDemo()
    return
  }
  demoThings = stored.things
  demoSources = stored.sources ?? []
  demoLoci = stored.loci ?? []
  demoPaths = stored.paths ?? []
}

hydrateDemo()

// Date.now() alone collides when several demo rows are created in the same
// tick — exactly what a Kobo import's per-highlight loop does, caught live
// (React "two children with the same key") rather than by a unit test, since
// no single-item test creates two things fast enough to collide.
let demoIdCounter = 0
function demoId(prefix: string): string {
  demoIdCounter += 1
  return `${prefix}-${Date.now()}-${demoIdCounter}`
}

/** Resets the demo store back to the fixtures — used by tests, and by
 *  Settings' "Reset the demo forest" so a demo someone has scribbled all
 *  over can be put back without clearing the whole origin's storage. */
export function resetDemoThings(): void {
  demoThings = [...DEMO_THINGS]
  demoSources = [...DEMO_SOURCES]
  demoLoci = [...DEMO_LOCI]
  demoPaths = [...DEMO_PATHS]
  removeJson(DEMO_KEY)
  persistDemo()
}

export class SilvaStore {
  private token: string
  private thingsDbId: string | null
  private sourcesDbId: string | null
  private lociDbId: string | null
  private pathsDbId: string | null

  constructor(
    token: string,
    thingsDbId: string | null = DEFAULT_THINGS_DATABASE_ID,
    sourcesDbId: string | null = DEFAULT_SOURCES_DATABASE_ID,
    lociDbId: string | null = DEFAULT_LOCI_DATABASE_ID,
    pathsDbId: string | null = DEFAULT_PATHS_DATABASE_ID,
  ) {
    this.token = token
    this.thingsDbId = thingsDbId
    this.sourcesDbId = sourcesDbId
    this.lociDbId = lociDbId
    this.pathsDbId = pathsDbId
  }

  /** No token → demo. Token but no database id → empty, never a silent mix
   *  of demo rows into a live workspace. */
  private useDemo(): boolean {
    return !this.token
  }

  /** A harmless read against the Things database — enough to tell a real
   *  token/workspace from a typo without creating or changing anything. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.token) return { ok: false, message: 'Enter a Notion token first.' }
    if (!this.thingsDbId) return { ok: false, message: 'No Things database configured.' }
    try {
      await this.request(`databases/${this.thingsDbId}`, 'GET')
      return { ok: true, message: 'Connected — Silva can read and write your Notion databases.' }
    } catch (e) {
      return { ok: false, message: e instanceof SilvaStoreError ? e.message : 'Could not connect.' }
    }
  }

  private async request(
    path: string,
    method: string,
    body?: unknown,
    version?: string,
  ): Promise<Record<string, unknown>> {
    // Paced and retried — see lib/requestQueue.ts. A Kobo import, a clearing
    // being dissolved and a season's expiry all issue writes in bursts that
    // otherwise blow straight past the relay's 20-per-10s limit.
    return notionQueue(async () => {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-notion-token': this.token },
        body: JSON.stringify({ path, method, body, version }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}) as { message?: string })
        const retryAfter = Number(res.headers.get('retry-after'))
        throw new SilvaStoreError(
          payload.message || `Notion API error ${res.status}`,
          res.status,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
        )
      }
      return res.json().catch(() => ({}))
    })
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
    const now = todayIso()
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
      image: input.image ?? null,
      link: input.link ?? null,
      koboBookmarkId: input.koboBookmarkId ?? null,
    }

    if (this.useDemo()) {
      const thing: Thing = { ...draft, id: demoId('demo-thing') }
      demoThings = [thing, ...demoThings]
      persistDemo()
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
    // `Handle` is the Notion row's TITLE, derived from `body` at create time
    // (deriveHandle) — "so the row is legible in Notion itself" (SILVA.md).
    // It was never re-derived on an edit, so changing a thing's body left
    // its Notion row titled by the old opening words forever after: the one
    // column actually visible in a Notion table view, silently stale.
    const effectivePatch: Partial<Thing> =
      patch.body !== undefined && patch.handle === undefined
        ? { ...patch, handle: deriveHandle(patch.body) }
        : patch

    if (this.useDemo()) {
      let updated: Thing | undefined
      demoThings = demoThings.map((thing) => {
        if (thing.id !== id) return thing
        updated = { ...thing, ...effectivePatch }
        return updated
      })
      if (!updated) throw new SilvaStoreError(`No such thing: ${id}`, 404)
      persistDemo()
      return updated
    }

    const properties = patchProps(effectivePatch)
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
      persistDemo()
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
      persistDemo()
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
      coined: todayIso(),
    }

    if (this.useDemo()) {
      const locus: Locus = { ...draft, id: demoId('demo-locus') }
      demoLoci = [locus, ...demoLoci]
      persistDemo()
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
      persistDemo()
      return updated
    }

    const properties = patchLocusProps(patch)
    const page = await this.request(`pages/${id}`, 'PATCH', { properties })
    return toLocus(page as { id: string; properties: Record<string, unknown> })
  }

  /**
   * Deletes a thing outright — Notion's reversible `archived: true`, so it
   * lands in Notion's own trash and can be restored there for 30 days.
   *
   * Distinct from releasing, and deliberately so: releasing is *compost*,
   * the thing stays in the collection with `State = Released`. This is for
   * what should never have been kept at all — a mis-paste, a duplicate, a
   * photograph of the wrong page.
   *
   * Callers must archive any Path that referenced it first (App.tsx's
   * `handleDeleteThing`); a path's ends live on the Paths side, so nothing
   * here can reach them, and leaving them behind is what strands a path
   * with a dangling end.
   */
  async archiveThing(id: string): Promise<void> {
    if (this.useDemo()) {
      demoThings = demoThings.filter((thing) => thing.id !== id)
      persistDemo()
      return
    }

    if (!this.thingsDbId) {
      throw new SilvaStoreError('No Things database configured.', 0)
    }

    await this.request(`pages/${id}`, 'PATCH', { archived: true })
  }

  /**
   * Puts an archived thing back — the undo behind the delete toast.
   *
   * Takes the whole Thing rather than an id because the two backing stores
   * need different halves of it: live Notion only needs the id (the row is
   * still there, just archived), while the demo store removed the row
   * outright and has to be handed it back. One call, honest in both modes.
   */
  async unarchiveThing(thing: Thing): Promise<void> {
    if (this.useDemo()) {
      if (!demoThings.some((t) => t.id === thing.id)) demoThings = [thing, ...demoThings]
      persistDemo()
      return
    }
    await this.request(`pages/${thing.id}`, 'PATCH', { archived: false })
  }

  /** Same, for a path archived alongside the thing it connected. */
  async unarchivePath(path: Path): Promise<void> {
    if (this.useDemo()) {
      if (!demoPaths.some((p) => p.id === path.id)) demoPaths = [path, ...demoPaths]
      persistDemo()
      return
    }
    await this.request(`pages/${path.id}`, 'PATCH', { archived: false })
  }

  /** Same `archived: true` convention. Callers must clear `sourceId` from
   *  any Thing pointing at it first (App.tsx's `handleDeleteSource`) —
   *  the relation lives on the Things side, exactly like a locus. */
  async archiveSource(id: string): Promise<void> {
    if (this.useDemo()) {
      demoSources = demoSources.filter((source) => source.id !== id)
      persistDemo()
      return
    }

    if (!this.sourcesDbId) {
      throw new SilvaStoreError('No Sources database configured.', 0)
    }

    await this.request(`pages/${id}`, 'PATCH', { archived: true })
  }

  /** Notion's reversible "delete" (archived: true, same convention every
   *  app in this repo uses — see e.g. WhereItWent's notionClient.js).
   *  Callers must strip the id from any Thing's `lociIds` themselves first
   *  (lib/loci.ts's `withoutLocus` helper) — this only removes the locus
   *  record, since membership lives on the Things side. */
  async archiveLocus(id: string): Promise<void> {
    if (this.useDemo()) {
      demoLoci = demoLoci.filter((locus) => locus.id !== id)
      persistDemo()
      return
    }

    if (!this.lociDbId) {
      throw new SilvaStoreError('No Loci database configured.', 0)
    }

    await this.request(`pages/${id}`, 'PATCH', { archived: true })
  }

  async listPaths(): Promise<Path[]> {
    if (this.useDemo()) return [...demoPaths]
    if (!this.pathsDbId) return []
    const pages = await this.fetchAllPages(this.pathsDbId)
    return pages.map((page) => toPath(page as { id: string; properties: Record<string, unknown> }))
  }

  /** A path always carries its Why. Defaults to `origin: 'Yours'` — pass
   *  'Accepted' only when this is the result of accepting a provocation. */
  async createPath(input: NewPathInput): Promise<Path> {
    const draft: Omit<Path, 'id'> = {
      label: deriveLabel(input.fromHandle, input.toHandle),
      fromId: input.fromId,
      toId: input.toId,
      why: input.why,
      made: todayIso(),
      origin: input.origin ?? 'Yours',
    }

    if (this.useDemo()) {
      const path: Path = { ...draft, id: demoId('demo-path') }
      demoPaths = [path, ...demoPaths]
      persistDemo()
      return path
    }

    if (!this.pathsDbId) {
      throw new SilvaStoreError('No Paths database configured.', 0)
    }

    const page = await this.request('pages', 'POST', {
      parent: { database_id: this.pathsDbId },
      properties: toNotionPathProps(draft),
    })
    return toPath(page as { id: string; properties: Record<string, unknown> })
  }

  /** Only `why` is ever edited after the fact — changing what a path
   *  connects is functionally a different path, not an edit to this one. */
  async updatePathWhy(id: string, why: string): Promise<Path> {
    if (this.useDemo()) {
      let updated: Path | undefined
      demoPaths = demoPaths.map((path) => {
        if (path.id !== id) return path
        updated = { ...path, why }
        return updated
      })
      if (!updated) throw new SilvaStoreError(`No such path: ${id}`, 404)
      persistDemo()
      return updated
    }

    const properties = patchPathProps({ why })
    const page = await this.request(`pages/${id}`, 'PATCH', { properties })
    return toPath(page as { id: string; properties: Record<string, unknown> })
  }

  /**
   * Uploads a photograph and returns a ticket for `imageProperty` below.
   *
   * Two calls, mirroring Fit Check's `uploadPhoto` (src/fit-check/lib/
   * notionClient.ts): register the upload with Notion, then send the bytes
   * through the existing `api/notion-upload` multipart relay — the one Notion
   * call that isn't JSON. **No new serverless function**, which matters: the
   * budget is at 12 of 12 and SILVA.md commits Silva to adding none.
   *
   * It touches no page, so it works before a thing has an id.
   */
  async uploadPhoto(blob: Blob, filename: string): Promise<{ ref: string; name: string }> {
    if (!this.token) throw new SilvaStoreError('No Notion token — photos stay on this device.', 0)

    const created = await this.request(
      'file_uploads',
      'POST',
      { mode: 'single_part', filename, content_type: blob.type || 'image/jpeg' },
      NOTION_FILES_VERSION,
    )

    const res = await fetch(`${UPLOAD_URL}?id=${encodeURIComponent(String(created.id))}`, {
      method: 'POST',
      headers: {
        'x-notion-token': this.token,
        'content-type': blob.type || 'image/jpeg',
        'x-filename': encodeURIComponent(filename),
      },
      body: blob,
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}) as { message?: string })
      throw new SilvaStoreError(payload.message || `Photo upload failed (${res.status})`, res.status)
    }

    return { ref: String(created.id), name: filename }
  }

  /**
   * Points a thing's `Image` property at an uploaded file. Separate from
   * `updateThing` because a files property needs the newer Notion version and
   * a shape `patchProps` deliberately doesn't model — `Image` is the one
   * property Silva reads but never wrote until the photo lane existed.
   */
  async attachPhoto(thingId: string, photo: { ref: string; name: string }): Promise<Thing> {
    const page = await this.request(
      `pages/${thingId}`,
      'PATCH',
      {
        properties: {
          Image: { files: [{ type: 'file_upload', file_upload: { id: photo.ref }, name: photo.name }] },
        },
      },
      NOTION_FILES_VERSION,
    )
    return toThing(page as { id: string; properties: Record<string, unknown> })
  }

  /** Same archived:true convention as archiveLocus. */
  async archivePath(id: string): Promise<void> {
    if (this.useDemo()) {
      demoPaths = demoPaths.filter((path) => path.id !== id)
      persistDemo()
      return
    }

    if (!this.pathsDbId) {
      throw new SilvaStoreError('No Paths database configured.', 0)
    }

    await this.request(`pages/${id}`, 'PATCH', { archived: true })
  }
}
