/**
 * Locus <-> Notion row mapping. Schema is `Loci` under Notion's App
 * Databases page (see SILVA.md "Notion schema"). Same pattern as
 * `lib/sources.ts` — see that file for the rationale.
 *
 * A locus's membership (which Things sit in it) is never read or written
 * from here — that lives entirely on the Things side (`Thing.lociIds`),
 * same as `Source` in `lib/sources.ts`. This file only maps the locus
 * record itself: Name, Meaning, Coined.
 */

import { richText, title } from './richText'

export interface Locus {
  id: string
  name: string
  meaning: string
  /** ISO date (YYYY-MM-DD) — when it was coined. Loci are always
   *  retrospective, so this is never in the future relative to the things
   *  it gathers. */
  coined: string
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

export function toLocus(page: NotionPage): Locus {
  const props = (page && page.properties) || {}
  const get = (name: string) => props[name] as Record<string, unknown> | undefined

  return {
    id: page.id,
    name: plainText(get('Name')?.title),
    meaning: plainText(get('Meaning')?.rich_text),
    coined: ((get('Coined')?.date as { start?: string } | null)?.start || '').slice(0, 10),
  }
}

export function toNotionLocusProps(locus: Partial<Locus>) {
  const l = locus
  return {
    Name: title(l.name),
    Meaning: richText(l.meaning),
    Coined: { date: l.coined ? { start: l.coined } : null },
  }
}

/** Removes one locus id from a list of locus ids — the pure half of
 *  dissolving/merging away a locus. Membership lives entirely on the
 *  Things side (`Thing.lociIds`), so the caller runs this per affected
 *  Thing before calling `store.archiveLocus`. */
export function withoutLocus(lociIds: string[], locusId: string): string[] {
  return lociIds.filter((id) => id !== locusId)
}

/** Replaces one locus id with another in a list, deduping — the pure half
 *  of merging locus B's members onto survivor A. */
export function withLocusReplaced(lociIds: string[], fromLocusId: string, toLocusId: string): string[] {
  const replaced = lociIds.map((id) => (id === fromLocusId ? toLocusId : id))
  return [...new Set(replaced)]
}

const FIELD_TO_PROP: Record<string, string> = {
  name: 'Name',
  meaning: 'Meaning',
  coined: 'Coined',
}

/** Same pruning as `notion.ts`'s `patchProps` — only the fields present on
 *  `patch` get sent. */
export function patchLocusProps(patch: Partial<Locus>): Record<string, unknown> {
  const full = toNotionLocusProps(patch)
  const out: Record<string, unknown> = {}
  for (const [field, prop] of Object.entries(FIELD_TO_PROP)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      out[prop] = full[prop as keyof typeof full]
    }
  }
  return out
}
