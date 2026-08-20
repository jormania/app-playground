/**
 * Source <-> Notion row mapping. Schema is `Sources` under Notion's App
 * Databases page (see SILVA.md "Notion schema"). Same pattern as
 * `lib/notion.ts`'s Things mapping — see that file for the rationale.
 */

import { richText, title } from './richText'

export type SourceKind = 'Book' | 'Article' | 'Film' | 'Conversation' | 'Song' | 'Self' | 'Unknown'

export interface Source {
  id: string
  title: string
  author: string
  kind: SourceKind | null
  cover: string | null
  /** Kobo's own book identifier — "the key the importer matches on"
   *  (SILVA.md schema table). Null for a Source never touched by an import. */
  koboVolumeId: string | null
  notes: string
}

interface NotionRichTextRun {
  plain_text?: string
}

interface NotionPage {
  id: string
  properties: Record<string, unknown>
}

function plainText(runs: unknown): string {
  return Array.isArray(runs)
    ? (runs as NotionRichTextRun[]).map((r) => r?.plain_text || '').join('')
    : ''
}

function firstFileUrl(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const file = value[0] as { file?: { url?: string }; external?: { url?: string } }
  return file?.file?.url || file?.external?.url || null
}

export function toSource(page: NotionPage): Source {
  const props = (page && page.properties) || {}
  const get = (name: string) => props[name] as Record<string, unknown> | undefined

  return {
    id: page.id,
    title: plainText(get('Title')?.title),
    author: plainText(get('Author')?.rich_text),
    kind: ((get('Kind')?.select as { name?: string } | null)?.name as SourceKind | undefined) || null,
    cover: firstFileUrl(get('Cover')?.files),
    koboVolumeId: plainText(get('Kobo Volume ID')?.rich_text) || null,
    notes: plainText(get('Notes')?.rich_text),
  }
}

export function toNotionSourceProps(source: Partial<Source>) {
  const s = source
  return {
    Title: title(s.title),
    Author: richText(s.author),
    Kind: { select: s.kind ? { name: s.kind } : null },
    'Kobo Volume ID': richText(s.koboVolumeId),
    Notes: richText(s.notes),
  }
}

const FIELD_TO_PROP: Record<string, string> = {
  title: 'Title',
  author: 'Author',
  kind: 'Kind',
  koboVolumeId: 'Kobo Volume ID',
  notes: 'Notes',
}

/** Same pruning as `notion.ts`'s `patchProps` — only the fields present on
 *  `patch` get sent, so e.g. backfilling `koboVolumeId` alone never
 *  clobbers `Title`. */
export function patchSourceProps(patch: Partial<Source>): Record<string, unknown> {
  const full = toNotionSourceProps(patch)
  const out: Record<string, unknown> = {}
  for (const [field, prop] of Object.entries(FIELD_TO_PROP)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      out[prop] = full[prop as keyof typeof full]
    }
  }
  return out
}

/** The first run of digits in a locator — "p. 142" reads as page 142,
 *  "overheard on the 32 tram" reads as no page at all (a bus number isn't a
 *  place in the book). Anything without one sorts after everything that has
 *  one, so a source that mixes a few page numbers with a few non-numeric
 *  locators still puts what it can order first. */
function pageNumber(locator: string): number {
  const match = locator.match(/\d+/)
  return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY
}

/** Things from one source, in the order they sit in it — SILVA.md's Locator
 *  ("where in the source") used for the one thing it was always for, rather
 *  than sitting on the specimen label as decoration. Falls back to the order
 *  they were kept, which is the same fallback the app already used when
 *  locator wasn't consulted at all. */
export function orderWithinSource<T extends { locator: string; kept: string | null }>(things: T[]): T[] {
  return [...things].sort((a, b) => {
    const pa = pageNumber(a.locator)
    const pb = pageNumber(b.locator)
    // Two locator-less things are both Infinity, and Infinity - Infinity is
    // NaN — an invalid comparator result that silently disables sorting
    // rather than throwing, so the kept-order fallback below never ran.
    if (pa !== pb) return pa - pb
    return (a.kept || '').localeCompare(b.kept || '')
  })
}
