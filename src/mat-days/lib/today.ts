import type { PracticeEntry, Preferences, SeriesDef, Session, UserSessionData } from '../domain/types'
import { daysBetween } from './recommend'
import { belongsTo, dayOf, dayTheme } from './series'
import { fold, matchesIntention } from './filter'

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
    // A theme that is just the series name again, or empty, adds nothing: the day is the name.
    if (theme && fold(theme) !== fold(def.name)) return { title: theme, label }
    return { title: `${def.unit} ${day}`, label: def.name }
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

/**
 * What the hour suggests. Mornings lean towards waking up, evenings towards
 * winding down; the middle of the day is open. Matched by title words, so it
 * works on a library with no classification.
 */
export interface Moment {
  id: 'morning' | 'day' | 'evening' | 'night'
  kicker: string
  reason: string
  /** Sessions this moment prefers; none in the middle of the day. */
  suits?: (s: Session) => boolean
}

const relaxing = (s: Session) => matchesIntention(s, 'relax') || matchesIntention(s, 'restore')

export function momentOf(hour: number): Moment {
  if (hour >= 5 && hour < 11) return { id: 'morning', kicker: 'A practice for this morning', reason: 'To wake up the body', suits: (s) => matchesIntention(s, 'energise') }
  if (hour >= 11 && hour < 17) return { id: 'day', kicker: 'A practice for today', reason: '' }
  if (hour >= 17 && hour < 21) return { id: 'evening', kicker: 'A practice for this evening', reason: 'To let the day go', suits: relaxing }
  return { id: 'night', kicker: 'Something to wind down', reason: 'Slow and quiet, for before bed', suits: (s) => relaxing(s) && s.durationMinutes <= 30 }
}

/** Days since your most recent practice; null before the first one. */
export function daysAway(history: PracticeEntry[], today: string): number | null {
  let last = ''
  for (const h of history) if (h.date > last) last = h.date
  return last ? daysBetween(last, today) : null
}

/** After this many days away, Today welcomes you back before anything else. */
export const RETURN_AFTER_DAYS = 5

/** A gentle way back in: short, soft, nothing to prove. */
export const gentleReturn = (s: Session) => s.durationMinutes <= 20 && s.durationMinutes >= 5 && relaxing(s)

/**
 * Feeling and "good for", from the finish sheet, folded into the session so the
 * library fills itself in as you practise. Your own earlier choices are kept:
 * intensity is set only where none is, and goals and areas are added, never removed.
 */
export function learnFromPractice(s: Session, feel: number | undefined, goals: string[], areas: string[]): Session | null {
  const intensity = feel && (s.intensity === 0 || s.classificationSource === 'inferred') ? feel : s.intensity
  const objectives = [...new Set([...s.objectives, ...goals])]
  const physicalFocus = [...new Set([...s.physicalFocus, ...areas])]
  if (intensity === s.intensity && objectives.length === s.objectives.length && physicalFocus.length === s.physicalFocus.length) return null
  return { ...s, intensity, objectives, physicalFocus }
}

/** "Good for" choices on the finish sheet: plain words, each mapped to the vocabulary. */
export const GOOD_FOR_GOALS: { label: string; value: string }[] = [
  { label: 'Calm', value: 'Relaxation' }, { label: 'Energy', value: 'Energy' }, { label: 'Strength', value: 'Strength' },
  { label: 'Flexibility', value: 'Flexibility' }, { label: 'Mobility', value: 'Mobility' }, { label: 'Recovery', value: 'Recovery' },
  { label: 'Balance', value: 'Balance' },
]
export const GOOD_FOR_AREAS = ['Hips', 'Back', 'Shoulders', 'Neck', 'Core', 'Legs', 'Full body']

/** How a finished practice felt: three plain steps onto the intensity scale. */
export const FEELS: { label: string; value: number }[] = [
  { label: 'Gentle', value: 2 }, { label: 'Steady', value: 3 }, { label: 'Strong', value: 4 },
]
