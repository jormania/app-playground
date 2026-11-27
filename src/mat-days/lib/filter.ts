import type { PracticeEntry, Session, UserSessionData } from '../domain/types'
import { DURATION_BUCKETS, type DurationBucketId } from '../domain/vocabulary'
import { FOCUS_RULES } from './channel'

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
  /** One of INTENTIONS, by id: "Practise for…" from Today. */
  intention?: string | null
}

export type SortKey =
  | 'recent' | 'postedNew' | 'postedOld' | 'shortest' | 'longest' | 'intensityHigh' | 'intensityLow'
  | 'practisedRecent' | 'practisedLeast' | 'rating' | 'random'

/** Short, so the chosen one fits beside Filters and Favourites on a phone. */
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Just added' },
  { value: 'postedNew', label: 'Newest' },
  { value: 'postedOld', label: 'Oldest' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'longest', label: 'Longest' },
  { value: 'intensityHigh', label: 'Most intense' },
  { value: 'intensityLow', label: 'Gentlest' },
  { value: 'practisedRecent', label: 'Last practised' },
  { value: 'practisedLeast', label: 'Not practised lately' },
  { value: 'rating', label: 'Most wanted' },
  { value: 'random', label: 'Shuffle' },
]

export const EMPTY_FILTERS: Filters = {
  query: '', durations: [], styles: [], intensities: [], focus: [], objectives: [], energy: [],
  experience: [], timeOfDay: [], equipment: [], series: [], ratings: [], favouritesOnly: false, intention: null,
}

export interface PersonalContext {
  userData: Record<string, UserSessionData>
  /** sessionId → latest practice date (YYYY-MM-DD). */
  lastPractised: Record<string, string>
  /** "Practise for" leaves out women-specific practices (Settings). */
  skipWomenSpecific?: boolean
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
  if (f.intention && !matchesIntention(s, f.intention)) return false
  if (f.intention && ctx.skipWomenSpecific && isWomenSpecific(s)) return false

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
  // what Mat Days proposes, not about what you can find.
  return sortSessions(sessions.filter((s) => matches(s, f, ctx)), sort, ctx, seed)
}

export function activeFilterCount(f: Filters): number {
  return (f.query.trim() ? 1 : 0) + f.durations.length + (f.customMin != null ? 1 : 0) + (f.customMax != null ? 1 : 0) +
    f.styles.length + f.intensities.length + f.focus.length + f.objectives.length + f.energy.length +
    f.experience.length + f.timeOfDay.length + f.equipment.length + f.series.length + (f.ratings?.length ?? 0) +
    (f.favouritesOnly ? 1 : 0) + (f.intention ? 1 : 0)
}

export interface Intention {
  id: string
  label: string
  hint: string
  /** What a classified session needs to match (all of it). */
  fields: Partial<Filters>
  /** Words in the title or series that match too: most channel sessions carry no classification. */
  words: string[]
}

/**
 * Today's "Practise for" cards. Each is one named filter, matched either by a
 * session's classification or by words in its title, since most of Adriene's
 * channel arrives without styles, goals or intensity filled in.
 */
export const INTENTIONS: Intention[] = [
  { id: 'strength', label: 'Build strength', hint: 'Power, core, steady effort', fields: { objectives: ['Strength'] },
    words: ['strength', 'strong', 'power', 'core', 'tone', 'toning', 'abs', 'arms', 'sweat', 'burn'] },
  { id: 'flexibility', label: 'Improve flexibility', hint: 'Long holds, deep stretch', fields: { objectives: ['Flexibility'] },
    words: ['flexib', 'stretch', 'hamstring', 'splits', 'hip open', 'deep', 'yin'] },
  { id: 'restore', label: 'Restore and recover', hint: 'Soft, slow, supported', fields: { objectives: ['Recovery'] },
    words: ['restor', 'recover', 'gentle', 'yin', 'sore', 'tired', 'sooth', 'heal', 'slow', 'rest ', 'self care', 'self-care', 'tlc', 'nurtur', 'comfort'] },
  { id: 'mobility', label: 'Improve mobility', hint: 'Joints that move freely', fields: { objectives: ['Mobility'] },
    words: ['mobility', 'mobilis', 'mobiliz', 'joint', 'spine', 'spinal', 'hips', 'release', 'stiff'] },
  { id: 'balance', label: 'Balance and stability', hint: 'Grounded and steady', fields: { objectives: ['Balance', 'Stability'] },
    words: ['balance', 'stabil', 'stable', 'ground', 'steady', 'root'] },
  { id: 'energise', label: 'Energise and wake up', hint: 'A brighter start', fields: { objectives: ['Energy'] },
    words: ['energ', 'wake up', 'morning', 'boost', 'vitality', 'uplift', 'rise', 'awaken', 'fresh', 'power'] },
  { id: 'relax', label: 'Relax and unwind', hint: 'Let the day go', fields: { objectives: ['Relaxation', 'Stress reduction'] },
    words: ['relax', 'calm', 'unwind', 'stress', 'anxi', 'sleep', 'bedtime', 'before bed', 'evening', 'night', 'soothe', 'meditat', 'chill', 'pause', 'melt', 'nervous system'] },
  { id: 'posture', label: 'Improve posture', hint: 'Back, chest, shoulders', fields: { objectives: ['Posture'] },
    words: ['posture', 'back', 'shoulder', 'neck', 'desk', 'computer', 'tech', 'upper body', 'chest'] },
  { id: 'short', label: 'Find a short practice', hint: 'Under fifteen minutes', fields: { customMax: 15 }, words: [] },
]

/** An intention by id, including the body-area ones ("area:Hips"). */
export function intentionById(id: string): Intention | undefined {
  if (id.startsWith('area:')) {
    const area = id.slice(5)
    const words = FOCUS_RULES.find(([a]) => a === area)?.[1] ?? [area.toLowerCase()]
    return { id, label: area, hint: '', fields: { focus: [area] }, words }
  }
  return INTENTIONS.find((x) => x.id === id)
}

/**
 * Channel videos that aren't a practice: vlogs, cooking, Q&As, tips, trailers,
 * series welcomes, pose tutorials and kids' yoga. Still searchable in Explore;
 * never offered by "Practise for", Today or Surprise Me.
 */
const EXTRA_PATTERNS = [
  /\bvlog\b/, /\bcooking\b/, /\brecipe/, /\byoga tips?\b/, /\btips?:/, /questions answered/, /\bq ?& ?a\b/, /\bwelcome to\b/,
  /\bstart here\b/, /\btrailer\b/, /\bis back\b/, /\bannounc/, /\bgiveaway\b/, /behind the scenes/, /\binterview\b/,
  /\bpodcast\b/, /\bteaser\b/, /coming soon/, /sneak peek/, /\bfoundations of (?!flow)/, /\bfor kids\b/,
  /\byoga pe\b/, /\bkids yoga\b/, /\bhow to\b/, /\bthank you\b/, /\bunboxing\b/, /^what is\b/,
  // A series' own name with no day: its trailer ("CENTER - A 30 Day Yoga Journey").
  /^[a-z ]+ - a 30 day yoga journey$/,
]

export function isExtra(s: Pick<Session, 'title' | 'durationMinutes'> & { description?: string }): boolean {
  // Her description says so when a video is a vlog ("This vlog is an attempt to answer…").
  if (s.description && /\b(this|today'?s|in this|a) vlog\b/.test(fold(s.description.slice(0, 300)))) return true
  const t = fold(s.title).replace(/\s+/g, ' ').replace(/\s*[|-]\s*yoga with adriene\s*$/, '').trim()
  if (EXTRA_PATTERNS.some((re) => re.test(t))) return true
  // "Side Plank Pose | Vasisthasana": a short breakdown of one pose.
  return s.durationMinutes < 12 && /\bpose\b/.test(t) && !/\byoga for\b/.test(t)
}

/**
 * Practices made for women's particular needs: pregnancy and after, the cycle,
 * menopause, fertility, or billed "for women". Generic ones (pelvic floor
 * included) are not. With the setting on, never suggested; always searchable.
 */
const WOMEN_SPECIFIC = [
  /\bfor women\b/, /\bwomen'?s\b/, /\bladies\b/, /prenatal/, /pregnan/, /postnatal/, /postpartum/, /trimester/,
  /\bpms\b/, /menstrua/, /\bperiod\b/, /menopaus/, /fertility/, /\b(new )?moms?\b/, /moms to be/, /\bmama\b/,
]

export function isWomenSpecific(s: Pick<Session, 'title'>): boolean {
  const t = fold(s.title)
  return WOMEN_SPECIFIC.some((re) => re.test(t))
}

const NO_CONTEXT: PersonalContext = { userData: {}, lastPractised: {} }

/** Does this session suit the intention, by its classification or its title? */
export function matchesIntention(s: Session, id: string): boolean {
  const i = intentionById(id)
  if (!i) return true
  if (isExtra(s)) return false
  // Short is about length alone; the rest also accept the title's own words.
  if (matches(s, { ...EMPTY_FILTERS, ...i.fields }, NO_CONTEXT, '')) return true
  if (!i.words.length) return false
  const text = ` ${fold(`${s.title} ${s.series ?? ''}`).replace(/[^a-z0-9]+/g, ' ')} `
  return i.words.some((w) => text.includes(` ${w}`))
}

/**
 * Filters saved before Release 7 held a "Practise for" card as raw fields
 * (Recovery + Very gentle + Gentle), which hid the card's name and found
 * nothing on an unclassified library. Read back, they become the named card.
 */
const LEGACY_INTENTIONS: { id: string; fields: Partial<Filters> }[] = [
  { id: 'restore', fields: { objectives: ['Recovery'], intensities: [1, 2] } },
  { id: 'energise', fields: { energy: ['Energising'] } },
  ...INTENTIONS.filter((i) => i.id !== 'short').map((i) => ({ id: i.id, fields: i.fields })),
]

export function upgradeFilters(f: Filters): Filters {
  if (f.intention) return f
  const keys = ['styles', 'intensities', 'focus', 'objectives', 'energy', 'experience', 'timeOfDay', 'equipment', 'series', 'durations', 'ratings'] as const
  const same = (a: unknown[] = [], b: unknown[] = []) => a.length === b.length && a.every((x) => b.includes(x))
  for (const legacy of LEGACY_INTENTIONS) {
    const lf = legacy.fields as Partial<Record<(typeof keys)[number], unknown[]>>
    if (keys.every((k) => same((f[k] ?? []) as unknown[], lf[k] ?? []))) {
      const cleared = Object.fromEntries(keys.map((k) => [k, []]))
      return { ...f, ...cleared, intention: legacy.id }
    }
  }
  return f
}
