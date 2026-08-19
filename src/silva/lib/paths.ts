/**
 * Path <-> Notion row mapping. Schema is `Paths` under Notion's App
 * Databases page (see SILVA.md "Notion schema"). Same pattern as
 * `lib/loci.ts` — see that file for the rationale.
 *
 * `From`/`To` are one-way relations to Things (SILVA.md: "Both relations
 * are one-way deliberately... Silva resolves paths by querying Paths
 * directly"), each holding a single id — unlike Things' `Loci`, these are
 * never arrays.
 */

import { richText, title } from './richText'

export type PathOrigin = 'Yours' | 'Accepted'

export interface Path {
  id: string
  label: string
  fromId: string | null
  toId: string | null
  /** The point of the record — what you saw between them. SILVA.md: "a
   *  path without its Why is precisely the artefact we are trying not to
   *  build" — never optional in the app, even though the schema allows it. */
  why: string
  /** ISO date (YYYY-MM-DD) — when you walked it. */
  made: string
  /** 'Yours' (you drew it) or 'Accepted' (you accepted a provocation) —
   *  descriptive only, never scored. Every path made before provocations
   *  exist (build-order step 9) is 'Yours'. */
  origin: PathOrigin | null
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

function relationOne(id: string | null | undefined) {
  return { relation: id ? [{ id }] : [] }
}

function relationId(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return (value[0] as { id?: string })?.id || null
}

export function toPath(page: NotionPage): Path {
  const props = (page && page.properties) || {}
  const get = (name: string) => props[name] as Record<string, unknown> | undefined

  return {
    id: page.id,
    label: plainText(get('Label')?.title),
    fromId: relationId(get('From')?.relation),
    toId: relationId(get('To')?.relation),
    why: plainText(get('Why')?.rich_text),
    made: ((get('Made')?.date as { start?: string } | null)?.start || '').slice(0, 10),
    origin: ((get('Origin')?.select as { name?: string } | null)?.name as PathOrigin | undefined) || null,
  }
}

export function toNotionPathProps(path: Partial<Path>) {
  const p = path
  return {
    Label: title(p.label),
    From: relationOne(p.fromId),
    To: relationOne(p.toId),
    Why: richText(p.why),
    Made: { date: p.made ? { start: p.made } : null },
    Origin: { select: p.origin ? { name: p.origin } : null },
  }
}

const FIELD_TO_PROP: Record<string, string> = {
  label: 'Label',
  fromId: 'From',
  toId: 'To',
  why: 'Why',
  made: 'Made',
  origin: 'Origin',
}

/** Same pruning as `notion.ts`'s `patchProps` — only the fields present on
 *  `patch` get sent. */
export function patchPathProps(patch: Partial<Path>): Record<string, unknown> {
  const full = toNotionPathProps(patch)
  const out: Record<string, unknown> = {}
  for (const [field, prop] of Object.entries(FIELD_TO_PROP)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      out[prop] = full[prop as keyof typeof full]
    }
  }
  return out
}

/** A short label auto-filled from the two things' handles (SILVA.md: "short
 *  label, auto-filled from the two handles"). */
export function deriveLabel(fromHandle: string, toHandle: string): string {
  return `${fromHandle} → ${toHandle}`
}
