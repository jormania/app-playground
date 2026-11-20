import type { PracticeEntry, Session } from '../domain/types'

/** Practice history arithmetic: pure functions over entries and the catalogue. */

/** "22 Jan 2024" from YYYY-MM-DD (or an ISO date-time); '' when unreadable. */
export function formatDay(date: string | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return ''
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Jan 2024": short enough for a card. */
export function formatMonth(date: string | undefined): string {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return ''
  return new Date(`${date.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return localDate(d)
}

export function newEntry(
  session: Session, input: { date: string; minutes?: number; rating?: number; note?: string }, now = new Date(),
): PracticeEntry {
  return {
    id: `p-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: session.id,
    date: input.date,
    minutes: input.minutes && input.minutes > 0 ? Math.round(input.minutes) : session.durationMinutes,
    rating: input.rating && input.rating >= 1 && input.rating <= 5 ? input.rating : undefined,
    note: input.note?.trim() || undefined,
    createdAt: now.toISOString(),
  }
}

export interface PracticeSummary {
  sessions: number
  minutes: number
  days: number
}

export function summarise(entries: PracticeEntry[]): PracticeSummary {
  return {
    sessions: entries.length,
    minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    days: new Set(entries.map((e) => e.date)).size,
  }
}

export function thisWeek(entries: PracticeEntry[], today: string): PracticeEntry[] {
  const start = weekStart(today)
  return entries.filter((e) => e.date >= start && e.date <= today)
}

/** Most common values of one session dimension across the history, highest first. */
export function topValues(
  entries: PracticeEntry[], sessions: Session[], pick: (s: Session) => string[], n = 3,
): { value: string; count: number }[] {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const counts = new Map<string, number>()
  for (const e of entries) {
    const s = byId.get(e.sessionId)
    if (!s) continue
    for (const v of pick(s)) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, n)
}
