/**
 * Thing <-> Notion row mapping. Schema is `Things` under Notion's App
 * Databases page (see SILVA.md "Notion schema" and project_silva-build-plan
 * memory for the live data-source id). Property names are exact and must
 * match the live database.
 *
 * Follows Loom's tested pattern (src/loom/lib/notion.js): one conditional per
 * field, defaults on read, explicit `null` to clear on write, and a
 * `patchProps` that prunes a full property payload down to only the fields a
 * caller's patch actually touched — so e.g. a bare `{ state: 'Kept' }` update
 * never re-sends (and so never clobbers) `Body`.
 */

import { richText, title } from './richText'

export type ThingKind =
  | 'Passage' | 'Observation' | 'Dialogue' | 'Question'
  | 'Image' | 'Link' | 'Fragment' | 'Mine'

export type ThingState = 'Understory' | 'Kept' | 'Released'

export interface Thing {
  id: string
  handle: string
  body: string
  kind: ThingKind | null
  state: ThingState
  sourceId: string | null
  locator: string
  /** ISO date (YYYY-MM-DD) — when it reached you. */
  encountered: string
  /** ISO date (YYYY-MM-DD), or null while in the understory. */
  kept: string | null
  note: string
  lociIds: string[]
  image: string | null
  link: string | null
  koboBookmarkId: string | null
  /**
   * When the thing arrived *in Silva* — Notion's own `created_time`, never a
   * property, so this costs no schema change and is right retroactively for
   * every row already in the database.
   *
   * Distinct from `encountered`, which is when it reached *you*: the Kobo
   * lane back-dates that to the highlight's own date, and a passage
   * highlighted two years ago is honestly two years old. But the season is
   * about how long something has sat unkept in the understory, so it counts
   * from here (lib/understory.ts) — otherwise an import of old reading was
   * composted on the very next load, before it could be looked at once.
   *
   * Null for a thing the store made without one (an optimistic draft, or an
   * older demo snapshot); `seasonStart` falls back to `encountered` then.
   */
  arrived: string | null
}

interface NotionRichTextRun {
  plain_text?: string
}

interface NotionPage {
  id: string
  properties: Record<string, unknown>
  /** Notion stamps this on every page; it is not a schema property. */
  created_time?: string
}

/** Notion splits styled text into runs; join them rather than reading run 0,
 *  which truncates at the first bold/linked word. */
function plainText(runs: unknown): string {
  return Array.isArray(runs)
    ? (runs as NotionRichTextRun[]).map((r) => r?.plain_text || '').join('')
    : ''
}

/** A short handle from the first words of a body — auto-filled at capture,
 *  editable afterward. Cuts on a word boundary rather than mid-word. */
export function deriveHandle(body: string, maxLength = 60): string {
  const clean = String(body || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  const cut = clean.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}

function relationIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((r) => (r as { id?: string })?.id).filter((id): id is string => Boolean(id))
    : []
}

/** A relation property write. Empty MUST be `[]`, never `[{ id: '' }]` —
 *  Notion 400s on the latter (WhereItWent's convention, same rule here). */
function relationList(ids: string[] | null | undefined) {
  return { relation: (ids || []).filter(Boolean).map((id) => ({ id })) }
}

function relationOne(id: string | null | undefined) {
  return { relation: id ? [{ id }] : [] }
}

function firstFileUrl(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const file = value[0] as { file?: { url?: string }; external?: { url?: string } }
  return file?.file?.url || file?.external?.url || null
}

export function toThing(page: NotionPage): Thing {
  const props = (page && page.properties) || {}
  const get = (name: string) => props[name] as Record<string, unknown> | undefined

  return {
    id: page.id,
    handle: plainText(get('Handle')?.title),
    body: plainText(get('Body')?.rich_text),
    kind: ((get('Kind')?.select as { name?: string } | null)?.name as ThingKind | undefined) || null,
    state: ((get('State')?.select as { name?: string } | null)?.name as ThingState | undefined) || 'Understory',
    sourceId: relationIds(get('Source')?.relation)[0] || null,
    locator: plainText(get('Locator')?.rich_text),
    encountered: ((get('Encountered')?.date as { start?: string } | null)?.start || '').slice(0, 10),
    kept: ((get('Kept')?.date as { start?: string } | null)?.start || '').slice(0, 10) || null,
    note: plainText(get('Note')?.rich_text),
    lociIds: relationIds(get('Loci')?.relation),
    image: firstFileUrl(get('Image')?.files),
    link: (get('Link')?.url as string | null) || null,
    koboBookmarkId: plainText(get('Kobo Bookmark ID')?.rich_text) || null,
    arrived: (page?.created_time || '').slice(0, 10) || null,
  }
}

/** Full Notion property payload for a thing. Used both for a create (full
 *  object) and, pruned by `patchProps`, for an update. */
export function toNotionThingProps(thing: Partial<Thing>) {
  const t = thing
  return {
    Handle: title(t.handle),
    Body: richText(t.body),
    Kind: { select: t.kind ? { name: t.kind } : null },
    State: { select: t.state ? { name: t.state } : null },
    Source: relationOne(t.sourceId),
    Locator: richText(t.locator),
    Encountered: { date: t.encountered ? { start: t.encountered } : null },
    Kept: { date: t.kept ? { start: t.kept } : null },
    Note: richText(t.note),
    Loci: relationList(t.lociIds),
    Link: { url: t.link || null },
    'Kobo Bookmark ID': richText(t.koboBookmarkId),
  }
}

const FIELD_TO_PROP: Record<string, string> = {
  handle: 'Handle',
  body: 'Body',
  kind: 'Kind',
  state: 'State',
  sourceId: 'Source',
  locator: 'Locator',
  encountered: 'Encountered',
  kept: 'Kept',
  note: 'Note',
  lociIds: 'Loci',
  link: 'Link',
  koboBookmarkId: 'Kobo Bookmark ID',
}

/** Prunes `toNotionThingProps` down to only the fields present on `patch` —
 *  so a caller that only sets `state`/`kept` never re-sends (and so never
 *  clobbers) `Body` or any other untouched field. */
export function patchProps(patch: Partial<Thing>): Record<string, unknown> {
  const full = toNotionThingProps(patch)
  const out: Record<string, unknown> = {}
  for (const [field, prop] of Object.entries(FIELD_TO_PROP)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      out[prop] = full[prop as keyof typeof full]
    }
  }
  return out
}
