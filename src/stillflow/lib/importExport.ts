import type { ClassificationSource, Confidence, Session } from '../domain/types'
import {
  DEFAULT_INSTRUCTOR, ENERGY, EQUIPMENT, EXPERIENCE, OBJECTIVES, PHYSICAL_FOCUS, STYLES, TIME_OF_DAY,
} from '../domain/vocabulary'
import { csvToObjects, toCsv } from './csv'
import { canonicalUrl, parseVideoId, thumbnailUrl } from './youtube'

/**
 * Catalogue import and export. An import is two steps: `previewImport` reads and
 * validates without touching anything, the user looks at the result and picks
 * how duplicates are handled, then `planImport` says exactly what will be written.
 *
 * Nothing is invented. A missing intensity stays 0 ("not classified"), a missing
 * list stays empty, and the record is flagged rather than guessed at. The only
 * derived values are the canonical watch URL and YouTube's own thumbnail, both
 * functions of the video id. Columns Stillflow has no field for are kept in
 * `extra`, never dropped.
 */

export const CSV_COLUMNS = [
  'id', 'title', 'description', 'instructor', 'youtubeUrl', 'youtubeVideoId', 'thumbnailUrl',
  'durationMinutes', 'styles', 'intensity', 'physicalFocus', 'objectives', 'energy', 'experienceLevel',
  'timeOfDay', 'equipment', 'series', 'seriesDay', 'publishedDate', 'tags', 'classificationConfidence',
  'classificationSource', 'dateAdded',
] as const

const LIST_FIELDS = ['styles', 'physicalFocus', 'objectives', 'energy', 'experienceLevel', 'timeOfDay', 'equipment', 'tags'] as const
type ListField = (typeof LIST_FIELDS)[number]

const VOCAB: Partial<Record<ListField, readonly string[]>> = {
  styles: STYLES, physicalFocus: PHYSICAL_FOCUS, objectives: OBJECTIVES, energy: ENERGY,
  experienceLevel: EXPERIENCE, timeOfDay: TIME_OF_DAY, equipment: EQUIPMENT,
}

const KNOWN = new Set<string>([...CSV_COLUMNS, 'isDemo', 'extra'])

export type RowStatus = 'new' | 'duplicate' | 'invalid'

export interface PreviewRow {
  index: number
  /** The row's title as written, so an unimportable row can still be named. */
  title: string
  status: RowStatus
  session?: Session
  /** Problems that stop the row being imported. */
  errors: string[]
  /** Things worth a look that don't stop it. */
  warnings: string[]
  /** Id of the existing catalogue record with the same video. */
  duplicateOf?: string
  /** Index of an earlier row in the same file with the same video. */
  duplicateInFile?: number
}

export interface ImportPreview {
  rows: PreviewRow[]
  /** The file couldn't be read at all. */
  fatal?: string
}

export type DuplicateMode = 'skip' | 'update' | 'replace'

export interface ImportPlan {
  write: Session[]
  added: number
  updated: number
  replaced: number
  skipped: number
  invalid: number
}

/** Accepts `a | b`, `a; b`, a JSON array, or an array value. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (value == null) return []
  const text = String(value).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try { return toList(JSON.parse(text)) } catch { /* fall through to splitting */ }
  }
  return text.split(/\s*[|;]\s*/).map((v) => v.trim()).filter(Boolean)
}

/** Canonical spelling for a vocabulary value, matched case-insensitively. */
function canon(list: readonly string[], value: string): string | null {
  return list.find((v) => v.toLowerCase() === value.toLowerCase()) ?? null
}

/** Minutes from `22`, `22.5`, `22:30` (mm:ss) or `1:02:30` (h:mm:ss); null if unreadable. */
export function parseDuration(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 ? Math.round(value) : null
  const text = String(value ?? '').trim()
  if (!text) return null
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Math.round(Number(text))
    return n > 0 ? n : null
  }
  const parts = text.split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return null
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts.length === 2 ? parts[0] * 60 + parts[1] : NaN
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.max(1, Math.round(seconds / 60))
}

const str = (v: unknown) => (v == null ? '' : String(v).trim())

/** One raw record to a Session, or the reasons it can't be one. */
export function normaliseRecord(
  raw: Record<string, unknown>, now: string, defaultInstructor = DEFAULT_INSTRUCTOR,
): { session?: Session; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  const title = str(raw.title)
  if (!title) errors.push('No title')

  const isDemo = raw.isDemo === true || str(raw.isDemo).toLowerCase() === 'true'
  const videoId = parseVideoId(str(raw.youtubeVideoId)) ?? parseVideoId(str(raw.youtubeUrl))
  if (!videoId && !isDemo) {
    errors.push(str(raw.youtubeUrl) || str(raw.youtubeVideoId) ? 'This isn’t a YouTube video link' : 'No YouTube link')
  }
  if (videoId && str(raw.youtubeVideoId) && str(raw.youtubeUrl)) {
    const fromUrl = parseVideoId(str(raw.youtubeUrl))
    if (fromUrl && fromUrl !== videoId) errors.push('The link and the video id point to different videos')
  }

  const duration = parseDuration(raw.durationMinutes ?? raw.duration)
  if (duration == null) errors.push('No length: add minutes, like 22 or 22:30')

  let intensity = Number(str(raw.intensity) || 0)
  if (!Number.isInteger(intensity) || intensity < 0 || intensity > 5) {
    warnings.push(`Intensity "${str(raw.intensity)}" isn’t 1–5, so it’s left empty`)
    intensity = 0
  } else if (intensity === 0) warnings.push('No intensity yet')

  const lists = {} as Record<ListField, string[]>
  for (const field of LIST_FIELDS) {
    const values = toList(raw[field])
    const vocab = VOCAB[field]
    lists[field] = vocab ? values.map((v) => canon(vocab, v) ?? v) : values
    const unknown = vocab ? values.filter((v) => !canon(vocab, v)) : []
    if (unknown.length) warnings.push(`Kept, though Stillflow doesn’t know it: ${unknown.join(', ')}`)
  }
  if (!lists.styles.length) warnings.push('No style yet')
  if (!lists.physicalFocus.length) warnings.push('No body area yet')

  const seriesDayRaw = str(raw.seriesDay)
  let seriesDay: number | null = null
  if (seriesDayRaw) {
    const n = Number(seriesDayRaw)
    if (Number.isInteger(n) && n >= 0 && n <= 366) seriesDay = n || null
    else warnings.push(`Series day "${seriesDayRaw}" isn’t a whole number, so it’s left out`)
  }

  let instructor = str(raw.instructor)
  const fallbackInstructor = defaultInstructor.trim() || DEFAULT_INSTRUCTOR
  if (!instructor) {
    instructor = fallbackInstructor
    warnings.push(`Instructor set to the default, ${fallbackInstructor}`)
  }

  const confidenceRaw = str(raw.classificationConfidence).toLowerCase()
  const confidence: Confidence = (['high', 'medium', 'low'] as const).find((c) => c === confidenceRaw) ?? 'low'
  const sourceRaw = str(raw.classificationSource).toLowerCase()
  const source: ClassificationSource = (['manual', 'verified', 'inferred'] as const).find((c) => c === sourceRaw) ?? 'inferred'
  if (confidenceRaw && confidence !== confidenceRaw) warnings.push(`Confidence "${confidenceRaw}" isn’t high, medium or low, so it’s set to low`)

  const extra: Record<string, string> = {}
  if (raw.extra && typeof raw.extra === 'object' && !Array.isArray(raw.extra)) {
    for (const [k, v] of Object.entries(raw.extra as Record<string, unknown>)) extra[k] = str(v)
  }
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN.has(k) && k !== 'duration' && str(v)) extra[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  if (Object.keys(extra).length) warnings.push(`Also kept: ${Object.keys(extra).join(', ')}`)

  if (errors.length) return { errors, warnings }

  const session: Session = {
    id: str(raw.id) || (videoId ? `yt-${videoId}` : `demo-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    title,
    description: str(raw.description) || undefined,
    instructor,
    youtubeUrl: videoId ? canonicalUrl(videoId) : str(raw.youtubeUrl),
    youtubeVideoId: videoId ?? '',
    thumbnailUrl: str(raw.thumbnailUrl) || (videoId ? thumbnailUrl(videoId) : undefined),
    durationMinutes: duration!,
    intensity,
    ...lists,
    series: str(raw.series) || undefined,
    seriesDay: seriesDay ?? undefined,
    publishedDate: str(raw.publishedDate) || undefined,
    classificationConfidence: confidence,
    classificationSource: source,
    dateAdded: str(raw.dateAdded) || now,
    ...(isDemo ? { isDemo: true } : {}),
    ...(Object.keys(extra).length ? { extra } : {}),
  }
  return { session, errors, warnings }
}

/** Reads a JSON array, `{ sessions: [...] }` (including a full backup), or CSV text. */
export function readRecords(text: string, format: 'json' | 'csv'): Record<string, unknown>[] {
  if (format === 'csv') return csvToObjects(text)
  const data: unknown = JSON.parse(text)
  const list = Array.isArray(data) ? data : (data as { sessions?: unknown })?.sessions
  if (!Array.isArray(list)) throw new Error('Expected an array of sessions, or an object with a "sessions" array')
  if (list.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('Every session must be an object')
  return list as Record<string, unknown>[]
}

export function detectFormat(fileName: string, text: string): 'json' | 'csv' {
  if (/\.json$/i.test(fileName)) return 'json'
  if (/\.csv$/i.test(fileName)) return 'csv'
  return /^\s*[[{]/.test(text) ? 'json' : 'csv'
}

const videoKey = (s: Session) => s.youtubeVideoId || `url:${s.youtubeUrl}`

export function previewImport(
  text: string, format: 'json' | 'csv', existing: Session[], now = new Date().toISOString(),
  defaultInstructor = DEFAULT_INSTRUCTOR,
): ImportPreview {
  let records: Record<string, unknown>[]
  try {
    records = readRecords(text, format)
  } catch (e) {
    return { rows: [], fatal: e instanceof Error ? e.message : 'The file could not be read' }
  }
  if (records.length === 0) return { rows: [], fatal: 'The file has no records' }

  const byVideo = new Map(existing.map((s) => [videoKey(s), s.id]))
  const seen = new Map<string, number>()
  const rows = records.map((raw, index): PreviewRow => {
    const { session, errors, warnings } = normaliseRecord(raw, now, defaultInstructor)
    if (!session) return { index, title: str(raw.title), status: 'invalid', errors, warnings }
    const key = videoKey(session)
    const earlier = seen.get(key)
    if (earlier != null) {
      return { index, title: session.title, status: 'invalid', errors: [`Same video as row ${earlier + 1}, so it’s skipped`], warnings, session, duplicateInFile: earlier }
    }
    seen.set(key, index)
    const duplicateOf = byVideo.get(key)
    return duplicateOf
      ? { index, title: session.title, status: 'duplicate', session, errors, warnings, duplicateOf }
      : { index, title: session.title, status: 'new', session, errors, warnings }
  })
  return { rows }
}

/**
 * update: fill the existing record with every non-empty incoming value, keeping
 *   its id and date added (personal data hangs off the id).
 * replace: the incoming record wins outright, but still under the existing id.
 * skip: leave the existing record alone.
 */
export function planImport(preview: ImportPreview, existing: Session[], mode: DuplicateMode): ImportPlan {
  const byId = new Map(existing.map((s) => [s.id, s]))
  const plan: ImportPlan = { write: [], added: 0, updated: 0, replaced: 0, skipped: 0, invalid: 0 }
  for (const row of preview.rows) {
    if (row.status === 'invalid' || !row.session) { plan.invalid++; continue }
    if (row.status === 'new') { plan.write.push(row.session); plan.added++; continue }
    const current = byId.get(row.duplicateOf!)
    if (!current || mode === 'skip') { plan.skipped++; continue }
    if (mode === 'replace') {
      plan.write.push({ ...row.session, id: current.id, dateAdded: current.dateAdded })
      plan.replaced++
    } else {
      plan.write.push(mergeSession(current, row.session))
      plan.updated++
    }
  }
  return plan
}

function mergeSession(current: Session, incoming: Session): Session {
  const merged: Session = { ...current }
  const target = merged as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'id' || k === 'dateAdded') continue
    const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0) || (k === 'intensity' && v === 0)
    if (!empty) target[k] = v
  }
  if (current.extra || incoming.extra) merged.extra = { ...current.extra, ...incoming.extra }
  return merged
}

export function exportJson(sessions: Session[], now = new Date()): string {
  return JSON.stringify({ app: 'stillflow', kind: 'catalogue', exportedAt: now.toISOString(), sessions }, null, 2)
}

/** Lists are joined with " | ". Extra columns kept from earlier imports, and isDemo, ride along. */
export function exportCsv(sessions: Session[]): string {
  const extraKeys = [...new Set(sessions.flatMap((s) => Object.keys(s.extra ?? {})))].sort()
  const header = [...CSV_COLUMNS, 'isDemo', ...extraKeys]
  const rows = sessions.map((s) => [
    ...CSV_COLUMNS.map((col) => {
      const v = (s as unknown as Record<string, unknown>)[col]
      if (Array.isArray(v)) return v.join(' | ')
      return v == null ? '' : String(v)
    }),
    s.isDemo ? 'true' : '',
    ...extraKeys.map((k) => s.extra?.[k] ?? ''),
  ])
  return toCsv(header, rows)
}
