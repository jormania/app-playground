/**
 * Backup, restore and CSV export.
 *
 * A backup is one JSON file: every record, client, source and venue, plus the
 * settings that shape the numbers (tax profile, target). The Notion token is
 * never written into it — a backup gets emailed and dropped into Drive.
 */
import type { CostRecord, IncomeRecord, InflowData, Settings } from '../domain/types'
import { ACTIVITY, CATEGORY, COST_CATEGORY, COST_GROUP_SHORT, STATUS, TAX_HANDLING, TAXABILITY, VAT } from '../domain/vocabulary'

export const BACKUP_APP = 'inflow'
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  settings: Omit<Settings, 'notionToken'>
  data: InflowData
}

export function makeBackup(data: InflowData, settings: Settings, now = new Date()): Backup {
  const { notionToken: _token, ...safe } = settings
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings: safe, data }
}

export class BackupError extends Error {}

/** Parse and check a backup file. Throws a BackupError with a sentence a person can act on. */
export function readBackup(text: string): Backup {
  let raw: any
  try { raw = JSON.parse(text) } catch { throw new BackupError('That file is not a backup: it is not valid JSON.') }
  if (raw?.app !== BACKUP_APP) throw new BackupError('That file is not an InFlow backup.')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('That backup was made by a newer InFlow. Update the app and try again.')
  }
  const d = raw.data ?? {}
  for (const k of ['records', 'clients', 'sources', 'venues'] as const) {
    if (!Array.isArray(d[k])) throw new BackupError(`The backup has no ${k} list; it may be damaged.`)
  }
  // Backups made before costs existed have none.
  if (d.costs !== undefined && !Array.isArray(d.costs)) throw new BackupError('The backup has a damaged costs list.')
  d.costs = d.costs ?? []
  const bad = (d.records as IncomeRecord[]).find((r) => !r || typeof r.id !== 'string' || typeof r.amountRon !== 'number' || !/^\d{4}-\d{2}-\d{2}/.test(r.date))
  if (bad) throw new BackupError('A record in the backup is missing its amount or date; it may be damaged.')
  return raw as Backup
}

// ── CSV ─────────────────────────────────────────────────────────────────────
function cell(v: string | number): string {
  // Text that starts like a formula would run as one in Excel or Sheets: keep it text.
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v)
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  // A BOM so Excel opens Romanian diacritics as UTF-8.
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function recordsCsv(records: IncomeRecord[], data: InflowData): string {
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name ?? ''
  return toCsv(
    ['Date', 'Description', 'Amount', 'Currency', 'FX rate', 'Amount RON', 'Status', 'Client', 'Source', 'Venue', 'Category',
      'Sessions', 'Hours', 'People', 'Recurring', 'Taxability', 'Tax handling', 'VAT', 'Classification', 'Tax reserve RON', 'Tax withheld RON', 'Tax rules', 'Notes'],
    [...records].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [
      r.date, r.description, r.amount, r.currency, r.fxRate, r.amountRon, STATUS[r.status],
      name(data.clients, r.clientId), name(data.sources, r.sourceId), name(data.venues, r.venueId),
      r.category ? CATEGORY[r.category] : '', r.sessions ?? 1, r.hours ?? '', r.attendees ?? '', r.recurring ? 'yes' : '', TAXABILITY[r.taxability],
      TAX_HANDLING[r.taxHandling], VAT[r.vat], r.classification, r.taxReserve ?? '', r.taxWithheld, r.taxRules, r.notes,
    ]),
  )
}

export function costsCsv(costs: CostRecord[], data: InflowData): string {
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name ?? ''
  return toCsv(
    ['Date', 'Description', 'Amount', 'Currency', 'FX rate', 'Amount RON', 'Status', 'Kind', 'Category', 'Venue', 'Client', 'Activity', 'Recurring', 'Deductible', 'Notes'],
    [...costs].sort((a, b) => a.date.localeCompare(b.date)).map((c) => [
      c.date, c.description, c.amount, c.currency, c.fxRate, c.amountRon, c.status === 'due' ? 'Due' : 'Paid', COST_GROUP_SHORT[c.group],
      COST_CATEGORY[c.category], name(data.venues, c.venueId), name(data.clients, c.clientId),
      c.activity ? ACTIVITY[c.activity] : '', c.recurring ? 'yes' : '', c.deductible ? 'yes' : '', c.notes,
    ]),
  )
}

/** Triggers a file download. Works in an installed Android PWA too. */
export function download(fileName: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
