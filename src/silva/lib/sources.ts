/**
 * Source <-> Notion row mapping. Schema is `Sources` under Notion's App
 * Databases page (see SILVA.md "Notion schema"). Same pattern as
 * `lib/notion.ts`'s Things mapping — see that file for the rationale.
 */

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

function richText(value: string | null | undefined) {
  return { rich_text: value ? [{ text: { content: String(value) } }] : [] }
}

function title(value: string | null | undefined) {
  return { title: [{ text: { content: String(value ?? '') } }] }
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
