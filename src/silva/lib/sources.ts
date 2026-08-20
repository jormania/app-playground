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

/** A files property written as an *external* file — a URL Notion links to
 *  rather than a blob it stores. Unlike `Thing.image` (which needs a real
 *  upload, and so a newer API version than this app is pinned to), a cover
 *  is somebody else's hosted image and needs nothing but the link. Empty
 *  array clears it, same convention as a relation. */
function externalFile(url: string | null | undefined, name: string) {
  return { files: url ? [{ type: 'external', name, external: { url } }] : [] }
}

export function toNotionSourceProps(source: Partial<Source>) {
  const s = source
  return {
    Title: title(s.title),
    Author: richText(s.author),
    Kind: { select: s.kind ? { name: s.kind } : null },
    Cover: externalFile(s.cover, 'cover.jpg'),
    'Kobo Volume ID': richText(s.koboVolumeId),
    Notes: richText(s.notes),
  }
}

const FIELD_TO_PROP: Record<string, string> = {
  title: 'Title',
  author: 'Author',
  kind: 'Kind',
  cover: 'Cover',
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

/** Ordered so a lower rank sorts first: pages, then positions, then things
 *  with no place in the source at all. Two locators only compare by value
 *  when they are the same kind — a page and a percentage measure different
 *  things and there is no honest way to interleave them. */
const LOCATOR_PAGE = 0
const LOCATOR_PERCENT = 1
const LOCATOR_UNPLACED = 2

interface LocatorPosition {
  kind: typeof LOCATOR_PAGE | typeof LOCATOR_PERCENT | typeof LOCATOR_UNPLACED
  value: number
}

/**
 * Where in a source a locator points, if anywhere.
 *
 * This used to be "the first run of digits", which claimed in its own
 * comment to read "overheard on the 32 tram" as no page at all — and then
 * read it as page 32, because a bare `\d+` matches digits anywhere in the
 * sentence. The Kobo import made that misreading visible: it writes "63% in"
 * when a chapter has no usable title (lib/kobo.ts `koboLocator`), which
 * scanned as *page 63* and sorted ahead of page 100 of the same book.
 *
 * So the digits have to earn their meaning from context:
 *
 * - **A percentage** — "63% in" — is a position through the work.
 * - **A page** is a number the locator *opens* with, optionally behind the
 *   usual abbreviations: "p. 142", "pp. 12-15", "page 7", "142".
 * - **Anything else** is prose that happens to contain a number, and points
 *   nowhere: a tram, a chapter name, a timestamp.
 */
function locatorPosition(locator: string): LocatorPosition {
  const percent = locator.match(/(\d+(?:\.\d+)?)\s*%/)
  if (percent) return { kind: LOCATOR_PERCENT, value: parseFloat(percent[1]) }

  const page = locator.match(/^\s*(?:p{1,2}\.?|pages?)?\s*(\d+)/i)
  if (page) return { kind: LOCATOR_PAGE, value: parseInt(page[1], 10) }

  return { kind: LOCATOR_UNPLACED, value: Number.POSITIVE_INFINITY }
}

/** Things from one source, in the order they sit in it — SILVA.md's Locator
 *  ("where in the source") used for the one thing it was always for, rather
 *  than sitting on the specimen label as decoration. Falls back to the order
 *  they were kept, which is the same fallback the app already used when
 *  locator wasn't consulted at all. */
export function orderWithinSource<T extends { locator: string; kept: string | null }>(things: T[]): T[] {
  return [...things].sort((a, b) => {
    const pa = locatorPosition(a.locator)
    const pb = locatorPosition(b.locator)
    // Kind first: a page and a percentage are different scales, so they
    // group rather than interleave. Within a kind, by position.
    if (pa.kind !== pb.kind) return pa.kind - pb.kind
    // Two unplaced things are both Infinity, and Infinity - Infinity is
    // NaN — an invalid comparator result that silently disables sorting
    // rather than throwing, so the kept-order fallback below never ran.
    if (pa.value !== pb.value) return pa.value - pb.value
    return (a.kept || '').localeCompare(b.kept || '')
  })
}
