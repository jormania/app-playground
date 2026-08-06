/**
 * Notion access for Fit Check.
 *
 * Shaped after WhereItWent's client, which earned its details the hard way:
 * every call goes through one `_request`, non-2xx throws (a rejected write must
 * never look like a successful one), 429/5xx retry with backoff, and sequential
 * writes are paced because Notion allows ~3 requests/second.
 *
 * Two Fit Check specifics:
 *   · Reads and writes go through `api/notion.js`, the shared stateless relay.
 *     No new serverless function — the repo is at Vercel Hobby's 12-function cap.
 *   · Every select/multi_select value is coerced through lib/vocabulary before
 *     it is written. An unregistered option makes Notion reject the whole patch.
 */
import { DEMO_GARMENTS, DEMO_OUTFITS } from '../models/demoData.ts'
import type { Garment, Outfit } from './types.ts'
import {
  CATEGORIES, COLOURS, HOMES, MOODS, STYLES, VERDICTS, WARMTHS,
  coerceMany, coerceOne,
} from './vocabulary.ts'

const PROXY_URL = '/api/notion'
/** Bytes go to the multipart relay — api/notion.js only speaks JSON (see that
 *  file's header for why the split exists). Both are generic and already
 *  deployed, so Fit Check adds no serverless function. */
const UPLOAD_URL = '/api/notion-upload'
/**
 * File uploads postdate the classic API version the rest of the app is pinned
 * to, so only these calls opt in. Everything else stays on the classic version
 * where query/create behaviour is stable.
 */
const NOTION_FILES_VERSION = '2025-09-03'
/** Notion allows ~3 requests/second. Sequential bulk work paces itself with this. */
const WRITE_SPACING_MS = 350
const MAX_RETRIES = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class NotionError extends Error {
  status: number | undefined
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'NotionError'
    this.status = status
  }
}

// ── Property helpers ────────────────────────────────────────────────────────

/** Notion splits styled text into runs; reading `[0]` truncates at the first. */
const plainText = (runs: unknown): string =>
  Array.isArray(runs) ? runs.map((r) => (r as { plain_text?: string })?.plain_text || '').join('') : ''

const richText = (value: string | null) =>
  ({ rich_text: value ? [{ text: { content: String(value) } }] : [] })

const title = (value: string) => ({ title: [{ text: { content: String(value ?? '') } }] })

const selectOf = (value: string | null) => ({ select: value ? { name: value } : null })

const multiOf = (values: string[]) => ({ multi_select: values.map((name) => ({ name })) })

type NotionPage = { id: string; properties: Record<string, any> }

function readGarment(row: NotionPage): Garment {
  const p = row.properties || {}
  const files = p.Photo?.files || []
  const first = files[0]
  return {
    id: row.id,
    name: plainText(p.Name?.title) || 'Untitled',
    // Signed and short-lived — lib/imageCache is what makes this usable.
    photoUrl: first?.file?.url || first?.external?.url || null,
    thumb: plainText(p.Thumb?.rich_text) || null,
    category: coerceOne(CATEGORIES, p.Category?.select?.name),
    colours: coerceMany(COLOURS, (p.Colours?.multi_select || []).map((o: { name: string }) => o.name)),
    warmth: coerceOne(WARMTHS, p.Warmth?.select?.name),
    styles: coerceMany(STYLES, (p.Style?.multi_select || []).map((o: { name: string }) => o.name)),
    home: coerceOne(HOMES, p.Home?.select?.name) ?? 'Both',
    favourite: Boolean(p.Favourite?.checkbox),
    wearCount: typeof p['Wear Count']?.number === 'number' ? p['Wear Count'].number : 0,
    lastWorn: p['Last Worn']?.date?.start || null,
    // An unset checkbox reads false, but a garment nobody has archived should
    // be active. Notion sends `false` for both, so absence can't be detected —
    // the app writes Active: true on create and this stays a plain read.
    active: Boolean(p.Active?.checkbox),
  }
}

function readOutfit(row: NotionPage): Outfit {
  const p = row.properties || {}
  return {
    id: row.id,
    name: plainText(p.Name?.title) || 'Outfit',
    date: p.Date?.date?.start || '',
    garmentIds: (p.Garments?.relation || []).map((r: { id: string }) => r.id),
    mood: coerceOne(MOODS, p.Mood?.select?.name),
    weather: plainText(p.Weather?.rich_text),
    verdict: coerceOne(VERDICTS, p.Verdict?.select?.name),
    favourite: Boolean(p.Favourite?.checkbox),
  }
}

// ── Client ──────────────────────────────────────────────────────────────────

export interface DbIds {
  garments?: string
  outfits?: string
}

export class NotionClient {
  token: string
  dbIds: DbIds

  constructor(token: string, dbIds: DbIds = {}) {
    this.token = token
    this.dbIds = dbIds
  }

  async _request({ path, method = 'POST', body, version, retries = MAX_RETRIES }: {
    path: string
    method?: string
    body?: unknown
    version?: string
    retries?: number
  }): Promise<any> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response
      try {
        response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
          body: JSON.stringify({ path, method, body, version }),
        })
      } catch (e) {
        lastError = new NotionError(`Could not reach Notion: ${(e as Error).message}`)
        await sleep(400 * (attempt + 1))
        continue
      }

      const text = await response.text()
      let payload: any = null
      try { payload = text ? JSON.parse(text) : null } catch { /* non-JSON error body */ }

      if (response.ok) return payload

      // 429 and 5xx are worth another go; 4xx is our bug and never is.
      if (response.status === 429 || response.status >= 500) {
        lastError = new NotionError(payload?.message || `Notion returned ${response.status}`, response.status)
        await sleep(400 * (attempt + 1))
        continue
      }

      throw new NotionError(payload?.message || `Notion returned ${response.status}`, response.status)
    }

    throw lastError ?? new NotionError('Notion request failed.')
  }

  /**
   * With no token we're in first-run/demo territory and serve fixtures. With a
   * token but no database id we return nothing rather than quietly mixing demo
   * rows into live data — a silent blend is far more confusing than an empty list.
   */
  _demoOr<T>(dbId: string | undefined, demoRows: T[]): { use: boolean; rows: T[] } {
    if (!this.token) return { use: true, rows: [...demoRows] }
    return { use: false, rows: dbId ? [] : [] }
  }

  async _queryAll(dbId: string): Promise<NotionPage[]> {
    const rows: NotionPage[] = []
    let cursor: string | undefined
    do {
      const page = await this._request({
        path: `databases/${dbId}/query`,
        body: cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 },
      })
      rows.push(...(page?.results || []))
      cursor = page?.has_more ? page.next_cursor : undefined
    } while (cursor)
    return rows
  }

  async listGarments(): Promise<Garment[]> {
    const demo = this._demoOr(this.dbIds.garments, DEMO_GARMENTS)
    if (demo.use) return demo.rows
    if (!this.dbIds.garments) return []
    return (await this._queryAll(this.dbIds.garments)).map(readGarment)
  }

  async listOutfits(): Promise<Outfit[]> {
    const demo = this._demoOr(this.dbIds.outfits, DEMO_OUTFITS)
    if (demo.use) return demo.rows
    if (!this.dbIds.outfits) return []
    return (await this._queryAll(this.dbIds.outfits)).map(readOutfit)
  }

  /**
   * Build a Notion property patch for a garment. Exported via the class so the
   * coercion is exercised by tests: every closed-vocabulary field goes through
   * `coerceOne`/`coerceMany`, so an AI-suggested tag that Notion doesn't know is
   * dropped here rather than taking the whole patch down with it.
   */
  _garmentProperties(garment: Partial<Garment>): Record<string, unknown> {
    const props: Record<string, unknown> = {}
    if (garment.name !== undefined) props.Name = title(garment.name)
    if (garment.thumb !== undefined) props.Thumb = richText(garment.thumb)
    if (garment.category !== undefined) props.Category = selectOf(coerceOne(CATEGORIES, garment.category))
    if (garment.colours !== undefined) props.Colours = multiOf(coerceMany(COLOURS, garment.colours))
    if (garment.warmth !== undefined) props.Warmth = selectOf(coerceOne(WARMTHS, garment.warmth))
    if (garment.styles !== undefined) props.Style = multiOf(coerceMany(STYLES, garment.styles))
    if (garment.home !== undefined) props.Home = selectOf(coerceOne(HOMES, garment.home))
    if (garment.favourite !== undefined) props.Favourite = { checkbox: garment.favourite }
    if (garment.wearCount !== undefined) props['Wear Count'] = { number: garment.wearCount }
    if (garment.lastWorn !== undefined) {
      props['Last Worn'] = { date: garment.lastWorn ? { start: garment.lastWorn } : null }
    }
    if (garment.active !== undefined) props.Active = { checkbox: garment.active }
    return props
  }

  async createGarment(garment: Partial<Garment>): Promise<Garment | null> {
    if (!this.token || !this.dbIds.garments) return null
    const row = await this._request({
      path: 'pages',
      body: {
        parent: { database_id: this.dbIds.garments },
        properties: this._garmentProperties({ active: true, wearCount: 0, ...garment }),
      },
    })
    await sleep(WRITE_SPACING_MS)
    return row ? readGarment(row) : null
  }

  async updateGarment(id: string, patch: Partial<Garment>): Promise<Garment | null> {
    if (!this.token) return null
    const row = await this._request({
      path: `pages/${id}`,
      method: 'PATCH',
      body: { properties: this._garmentProperties(patch) },
    })
    await sleep(WRITE_SPACING_MS)
    return row ? readGarment(row) : null
  }

  /**
   * Two Notion calls: register the upload, then send the bytes to the multipart
   * relay. Returns a ticket the caller passes to `attachPhoto`. It touches no
   * page, so it works before a new garment even has an id.
   */
  async uploadPhoto(blob: Blob, filename: string): Promise<{ ref: string; name: string }> {
    const created = await this._request({
      path: 'file_uploads',
      body: {
        mode: 'single_part',
        filename,
        content_type: blob.type || 'application/octet-stream',
      },
      version: NOTION_FILES_VERSION,
    })

    const res = await fetch(`${UPLOAD_URL}?id=${encodeURIComponent(created.id)}`, {
      method: 'POST',
      headers: {
        'x-notion-token': this.token,
        'content-type': blob.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(filename),
      },
      body: blob,
    })
    if (!res.ok) {
      let message = `Photo upload failed (${res.status})`
      try { message = (await res.json())?.message || message } catch { /* non-JSON body */ }
      throw new NotionError(message, res.status)
    }

    return { ref: created.id, name: filename }
  }

  /**
   * Point a garment's Photo property at an uploaded file. Notion's files
   * property has no "append" verb — every write replaces the whole array — and
   * a garment has exactly one photo, so replacing is what we want anyway.
   */
  async attachPhoto(garmentId: string, photo: { ref: string; name: string }): Promise<Garment | null> {
    const row = await this._request({
      path: `pages/${garmentId}`,
      method: 'PATCH',
      body: {
        properties: {
          Photo: { files: [{ type: 'file_upload', file_upload: { id: photo.ref }, name: photo.name }] },
        },
      },
      version: NOTION_FILES_VERSION,
    })
    await sleep(WRITE_SPACING_MS)
    return row ? readGarment(row) : null
  }

  /** Verifies the token and database ids without changing anything. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.token) return { ok: false, message: 'Add your Notion token first.' }
    if (!this.dbIds.garments) return { ok: false, message: 'Add the Garments database id first.' }
    try {
      await this._request({ path: `databases/${this.dbIds.garments}`, method: 'GET' })
      if (this.dbIds.outfits) {
        await this._request({ path: `databases/${this.dbIds.outfits}`, method: 'GET' })
      }
      return { ok: true, message: 'Connected. Your wardrobe is ready.' }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  }
}
