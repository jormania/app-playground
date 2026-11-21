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

/**
 * The part of a YouTube description worth reading on the session page:
 * everything before the channel's divider ("- - - - - -"), which is where
 * Yoga With Adriene's subscribe links and disclaimer begin. The full text is
 * kept and can be shown on request.
 */
export function descriptionLead(text: string | undefined): { lead: string; rest: boolean } {
  if (!text) return { lead: '', rest: false }
  const m = /\n\s*(?:-\s*){4,}/.exec(text)
  if (!m || m.index < 20) return { lead: text.trim(), rest: false }
  return { lead: text.slice(0, m.index).trim(), rest: true }
}

/**
 * A line or two from the opening of a video's description, for a quiet note
 * beside its thumbnail. Skips a first line that only repeats the title ("TRUE -
 * DAY 19 - THOUGHT"), keeps whole sentences up to about `max` characters, and
 * returns '' when there is nothing to say. Adriene's own words, never invented.
 */
export function teaser(description: string | undefined, title: string, max = 140): string {
  const lines = descriptionLead(description).lead.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const words = (t: string) => t.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  const inTitle = new Set(words(title))
  while (lines.length && words(lines[0]).every((w) => inTitle.has(w) || w === 'day')) lines.shift()
  const text = lines.join(' ').replace(/https?:\S+/g, '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const sentences = text.match(/[^.!?]+[.!?]+["”’]?|[^.!?]+$/g) ?? [text]
  let out = ''
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim()
    if (out && next.length > max) break
    out = next
    if (out.length >= max * 0.6) break
  }
  return out.length > max + 40 ? `${out.slice(0, max).replace(/\s+\S*$/, '')}…` : out
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
