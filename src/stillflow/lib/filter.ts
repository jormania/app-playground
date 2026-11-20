import type { PracticeEntry, Session, UserSessionData } from '../domain/types'
import { DURATION_BUCKETS, type DurationBucketId } from '../domain/vocabulary'

/**
 * The catalogue's search, filter and sort engine. Pure: (sessions, filters,
 * personal context) in, ordered sessions out.
 *
 * Within one category the chosen values are alternatives (Hips OR Back);
 * across categories they all have to hold (Hips AND under 20 min).
 */

export interface Filters {
  query: string
  durations: DurationBucketId[]
  customMin?: number
  customMax?: number
  styles: string[]
  intensities: number[]
  focus: string[]
  objectives: string[]
  energy: string[]
  experience: string[]
  timeOfDay: string[]
  equipment: string[]
  series: string[]
  /** Repeat interest 1–5; 0 selects sessions not rated yet. */
  ratings: number[]
  favouritesOnly: boolean
}

export type SortKey =
  | 'recent' | 'postedNew' | 'postedOld' | 'shortest' | 'longest' | 'intensityHigh' | 'intensityLow'
  | 'practisedRecent' | 'practisedLeast' | 'rating' | 'random'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'postedNew', label: 'Newest on YouTube' },
  { value: 'postedOld', label: 'Oldest on YouTube' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'longest', label: 'Longest' },
  { value: 'intensityHigh', label: 'Most intense' },
  { value: 'intensityLow', label: 'Gentlest' },
  { value: 'practisedRecent', label: 'Practised recently' },
  { value: 'practisedLeast', label: 'Not practised lately' },
  { value: 'rating', label: 'Want to repeat most' },
  { value: 'random', label: 'Shuffle' },
]

export const EMPTY_FILTERS: Filters = {
  query: '', durations: [], styles: [], intensities: [], focus: [], objectives: [], energy: [],
  experience: [], timeOfDay: [], equipment: [], series: [], ratings: [], favouritesOnly: false,
}

export interface PersonalContext {
  userData: Record<string, UserSessionData>
  /** sessionId → latest practice date (YYYY-MM-DD). */
  lastPractised: Record<string, string>
}

export function lastPractisedMap(history: PracticeEntry[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of history) if (!out[h.sessionId] || h.date > out[h.sessionId]) out[h.sessionId] = h.date
  return out
}

/** Lower-cased and stripped of diacritics, so "flexibilité" finds "flexibilite". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function searchText(s: Session): string {
  return fold([
    s.title, s.description ?? '', s.instructor, s.series ?? '',
    ...s.tags, ...s.styles, ...s.physicalFocus, ...s.objectives, ...s.energy,
  ].join(' \u0000 '))
}

export function inDurationBucket(minutes: number, id: DurationBucketId): boolean {
  const b = DURATION_BUCKETS.find((x) => x.id === id)
  return !!b && minutes >= b.min && minutes < b.max
}

const anyOf = (chosen: string[], values: string[]) => chosen.length === 0 || chosen.some((c) => values.includes(c))

export function matches(s: Session, f: Filters, ctx: PersonalContext, haystack = searchText(s)): boolean {
  const tokens = fold(f.query).split(/\s+/).filter(Boolean)
  if (tokens.some((t) => !haystack.includes(t))) return false

  if (f.durations.length && !f.durations.some((d) => inDurationBucket(s.durationMinutes, d))) return false
  if (f.customMin != null && s.durationMinutes < f.customMin) return false
  if (f.customMax != null && s.durationMinutes > f.customMax) return false
  if (f.intensities.length && !f.intensities.includes(s.intensity)) return false
  if (f.series.length && !f.series.includes(s.series ?? '')) return false
  if (f.favouritesOnly && !ctx.userData[s.id]?.favourite) return false
  if (f.ratings?.length && !f.ratings.includes(ctx.userData[s.id]?.rating ?? 0)) return false

  return anyOf(f.styles, s.styles) && anyOf(f.focus, s.physicalFocus) && anyOf(f.objectives, s.objectives) &&
    anyOf(f.energy, s.energy) && anyOf(f.experience, s.experienceLevel) &&
    anyOf(f.timeOfDay, s.timeOfDay) && anyOf(f.equipment, s.equipment)
}

/** Deterministic shuffle key, so "Shuffle" doesn't reorder on every keystroke. */
function hash(text: string, seed: number): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function sortSessions(list: Session[], key: SortKey, ctx: PersonalContext, seed = 1): Session[] {
  const out = [...list]
  const last = (s: Session) => ctx.lastPractised[s.id] ?? ''
  const rating = (s: Session) => ctx.userData[s.id]?.rating ?? 0
  const byTitle = (a: Session, b: Session) => a.title.localeCompare(b.title)
  const cmp: Record<SortKey, (a: Session, b: Session) => number> = {
    recent: (a, b) => b.dateAdded.localeCompare(a.dateAdded) || byTitle(a, b),
    // Sessions with no publish date go last either way.
    postedNew: (a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? '') || byTitle(a, b),
    postedOld: (a, b) => (a.publishedDate ?? '9999').localeCompare(b.publishedDate ?? '9999') || byTitle(a, b),
    shortest: (a, b) => a.durationMinutes - b.durationMinutes || byTitle(a, b),
    longest: (a, b) => b.durationMinutes - a.durationMinutes || byTitle(a, b),
    intensityHigh: (a, b) => b.intensity - a.intensity || byTitle(a, b),
    intensityLow: (a, b) => a.intensity - b.intensity || byTitle(a, b),
    // Never-practised sessions go last when asking for recent, first when asking for neglected.
    practisedRecent: (a, b) => last(b).localeCompare(last(a)) || byTitle(a, b),
    practisedLeast: (a, b) => last(a).localeCompare(last(b)) || byTitle(a, b),
    rating: (a, b) => rating(b) - rating(a) || byTitle(a, b),
    random: (a, b) => hash(a.id, seed) - hash(b.id, seed),
  }
  return out.sort(cmp[key])
}

export function applyFilters(
  sessions: Session[], f: Filters, sort: SortKey, ctx: PersonalContext, seed = 1,
): Session[] {
  // Sessions hidden from suggestions stay browsable here: hiding is about
  // what Stillflow proposes, not about what you can find.
  return sortSessions(sessions.filter((s) => matches(s, f, ctx)), sort, ctx, seed)
}

export function activeFilterCount(f: Filters): number {
  return (f.query.trim() ? 1 : 0) + f.durations.length + (f.customMin != null ? 1 : 0) + (f.customMax != null ? 1 : 0) +
    f.styles.length + f.intensities.length + f.focus.length + f.objectives.length + f.energy.length +
    f.experience.length + f.timeOfDay.length + f.equipment.length + f.series.length + (f.ratings?.length ?? 0) +
    (f.favouritesOnly ? 1 : 0)
}

/** Discover's practice intentions, each a ready-made filter for Explore. */
export const INTENTIONS: { id: string; label: string; hint: string; filters: Partial<Filters> }[] = [
  { id: 'strength', label: 'Build strength', hint: 'Power, core, steady effort', filters: { objectives: ['Strength'] } },
  { id: 'flexibility', label: 'Improve flexibility', hint: 'Long holds, deep stretch', filters: { objectives: ['Flexibility'] } },
  { id: 'restore', label: 'Restore and recover', hint: 'Soft, slow, supported', filters: { objectives: ['Recovery'], intensities: [1, 2] } },
  { id: 'mobility', label: 'Improve mobility', hint: 'Joints that move freely', filters: { objectives: ['Mobility'] } },
  { id: 'balance', label: 'Balance and stability', hint: 'Grounded and steady', filters: { objectives: ['Balance', 'Stability'] } },
  { id: 'energise', label: 'Energise and wake up', hint: 'A brighter start', filters: { energy: ['Energising'] } },
  { id: 'relax', label: 'Relax and unwind', hint: 'Let the day go', filters: { objectives: ['Relaxation', 'Stress reduction'] } },
  { id: 'posture', label: 'Improve posture', hint: 'Back, chest, shoulders', filters: { objectives: ['Posture'] } },
  { id: 'short', label: 'Find a short practice', hint: 'Under fifteen minutes', filters: { customMax: 15 } },
]
