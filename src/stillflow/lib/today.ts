import type { PracticeEntry, Preferences, SeriesDef, Session, UserSessionData } from '../domain/types'
import { daysBetween } from './recommend'
import { belongsTo, dayOf, dayTheme } from './series'
import { fold } from './filter'

/**
 * The small decisions behind the Today screen, kept pure so they can be tested
 * without a browser: what to repeat, how to name a card, when to nudge a backup.
 */

/** Tag on a session YouTube no longer serves (private, deleted or blocked). */
export const UNAVAILABLE_TAG = 'unavailable'

export const isUnavailable = (s: Session) => s.tags.includes(UNAVAILABLE_TAG)

/**
 * How long after your last practice a session is due again, by how much you
 * want to repeat it. "Want to repeat" and "A staple" come back after six
 * weeks; "Happy to repeat" after three months. Lower ratings never nag.
 */
export const REPEAT_AFTER_DAYS: Record<number, number> = { 3: 90, 4: 42, 5: 42 }

export interface DueRepeat {
  session: Session
  rating: number
  /** Days since you last practised it. */
  since: number
}

export function dueForRepeat(
  sessions: Session[], userData: Record<string, UserSessionData>, lastPractised: Record<string, string>, today: string, limit = 8,
): DueRepeat[] {
  const out: DueRepeat[] = []
  for (const s of sessions) {
    const u = userData[s.id]
    const rating = u?.rating ?? 0
    const after = REPEAT_AFTER_DAYS[rating]
    const last = lastPractised[s.id]
    if (!after || !last || u?.excluded || isUnavailable(s)) continue
    const since = daysBetween(last, today)
    if (since >= after) out.push({ session: s, rating, since })
  }
  // Staples first, then whatever has waited longest.
  return out.sort((a, b) => b.rating - a.rating || b.since - a.since).slice(0, limit)
}

const CHANNEL_SUFFIX = /\s*[|–-]\s*yoga with adriene\s*$/i

/**
 * A card-sized name. For a series day, the day's own theme with the series and
 * day as a small label: "Day 2 - Open | MOVE - A 30 Day Yoga Journey" → "Open",
 * "MOVE · Day 2". Elsewhere, the title without a trailing "| Yoga With Adriene".
 * The full YouTube title stays on the session page.
 */
export function shortTitle(s: Session, defs: SeriesDef[]): { title: string; label?: string } {
  const day = s.series ? dayOf(s) : null
  const def = day ? defs.find((d) => belongsTo(s, d)) : undefined
  if (def && day) {
    const theme = dayTheme(s.title, def)
    const label = `${def.name} · ${def.unit} ${day}`
    // A theme that is just the series name again, or empty, adds nothing.
    if (theme && fold(theme) !== fold(def.name)) return { title: theme, label }
    return { title: s.title.replace(CHANNEL_SUFFIX, ''), label }
  }
  const title = s.title.replace(CHANNEL_SUFFIX, '').trim()
  return { title: title || s.title, label: s.series || undefined }
}

/** Practices recorded since the last backup was saved. */
export function sinceBackup(history: PracticeEntry[], lastBackupAt?: string): number {
  if (!lastBackupAt) return history.length
  return history.filter((h) => h.createdAt > lastBackupAt).length
}

/**
 * Whether Today should suggest saving a backup. Your history lives only in this
 * browser, so: after ten practices with no backup at all, after twenty new
 * ones since the last, or a month on with anything new. "Not now" quiets it for
 * a week.
 */
export function backupNudge(history: PracticeEntry[], prefs: Pick<Preferences, 'lastBackupAt' | 'backupNudgeDismissedAt'>, today: string): number | null {
  const since = sinceBackup(history, prefs.lastBackupAt)
  if (since === 0) return null
  if (prefs.backupNudgeDismissedAt && daysBetween(prefs.backupNudgeDismissedAt.slice(0, 10), today) < 7) return null
  if (!prefs.lastBackupAt) return history.length >= 10 ? since : null
  const age = daysBetween(prefs.lastBackupAt.slice(0, 10), today)
  return since >= 20 || age > 30 ? since : null
}

/**
 * After an availability check: the sessions whose "unavailable" tag must
 * change. Only the ids that were checked are touched, so a partial check never
 * clears a tag it didn't verify.
 */
export function applyAvailability(sessions: Session[], checked: string[], available: string[]): Session[] {
  const asked = new Set(checked)
  const ok = new Set(available)
  const out: Session[] = []
  for (const s of sessions) {
    const id = s.youtubeVideoId
    if (!id || !asked.has(id)) continue
    const gone = !ok.has(id)
    if (gone === isUnavailable(s)) continue
    out.push({ ...s, tags: gone ? [...s.tags, UNAVAILABLE_TAG] : s.tags.filter((t) => t !== UNAVAILABLE_TAG) })
  }
  return out
}

/** Weekly progress for the ring: minutes this week against the goal. */
export function weekRing(minutes: number, target?: number): { frac: number; label: string } {
  if (!target) return { frac: 0, label: `${minutes} min` }
  return { frac: Math.min(1, minutes / target), label: `${minutes} of ${target} min` }
}
