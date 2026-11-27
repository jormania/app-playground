import { isExtra, isWomenSpecific } from './filter'
import type { PracticeEntry, Preferences, Session, UserSessionData } from '../domain/types'
import { INTENSITY_LABELS } from '../domain/vocabulary'

/**
 * Surprise Me: a local weighted pick with a plain-language reason. No network,
 * no AI. Each mode narrows the catalogue to sessions that suit it and gives
 * each one a weight; the shared adjustments then keep it from repeating itself
 * (anything practised in the last few days, or shown in this sitting, is
 * heavily discounted) and a weighted draw picks one.
 */

export type SurpriseMode =
  | 'match' | 'random' | 'different' | 'challenge' | 'recovery' | 'short' | 'rediscover' | 'comfort'

export const MODES: { id: SurpriseMode; label: string; hint: string }[] = [
  { id: 'match', label: 'Perfect match', hint: 'Your preferences, time and recent practice' },
  { id: 'random', label: 'Completely random', hint: 'Anything in the library' },
  { id: 'different', label: 'Something different', hint: 'A style you rarely practise' },
  { id: 'challenge', label: 'Challenge me', hint: 'Strong, demanding work' },
  { id: 'recovery', label: 'Recovery day', hint: 'Gentle and restorative' },
  { id: 'short', label: 'Short and effective', hint: 'Within your time limit' },
  { id: 'rediscover', label: 'Rediscover', hint: 'A favourite you haven’t revisited' },
  { id: 'comfort', label: 'Outside my comfort zone', hint: 'Unlike your usual practice' },
]

export interface Constraints {
  maxDuration?: number
  minIntensity?: number
  maxIntensity?: number
  focus: string[]
  styles: string[]
  excludeStyles: string[]
  excludeCompleted: boolean
  favourites: 'any' | 'only' | 'exclude'
}

export const DEFAULT_CONSTRAINTS: Constraints = {
  focus: [], styles: [], excludeStyles: [], excludeCompleted: false, favourites: 'any',
}

export interface RecommendContext {
  sessions: Session[]
  userData: Record<string, UserSessionData>
  history: PracticeEntry[]
  preferences: Preferences
  /** Ids already suggested in this sitting; Try Another moves past them. */
  shown: string[]
  /** YYYY-MM-DD, local. */
  today: string
  /** Narrows the pool (time of day, a gentle return) without changing what the profile learns from. */
  only?: (s: Session) => boolean
}

export interface Pick {
  session: Session
  reason: string
  poolSize: number
}

export interface Profile {
  /** Practices in the last 30 days. */
  recentCount: number
  styleCounts: Record<string, number>
  focusCounts: Record<string, number>
  objectiveCounts: Record<string, number>
  allStyleCounts: Record<string, number>
  timesPractised: Record<string, number>
  lastPractised: Record<string, string>
  averageIntensity: number | null
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

const bump = (m: Record<string, number>, keys: string[]) => { for (const k of keys) m[k] = (m[k] ?? 0) + 1 }

export function buildProfile(sessions: Session[], history: PracticeEntry[], today: string): Profile {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const p: Profile = {
    recentCount: 0, styleCounts: {}, focusCounts: {}, objectiveCounts: {}, allStyleCounts: {},
    timesPractised: {}, lastPractised: {}, averageIntensity: null,
  }
  let intensitySum = 0, intensityN = 0
  for (const h of history) {
    p.timesPractised[h.sessionId] = (p.timesPractised[h.sessionId] ?? 0) + 1
    if (!p.lastPractised[h.sessionId] || h.date > p.lastPractised[h.sessionId]) p.lastPractised[h.sessionId] = h.date
    const s = byId.get(h.sessionId)
    if (!s) continue
    bump(p.allStyleCounts, s.styles)
    if (daysBetween(h.date, today) <= 30) {
      p.recentCount++
      bump(p.styleCounts, s.styles)
      bump(p.focusCounts, s.physicalFocus)
      bump(p.objectiveCounts, s.objectives)
      if (s.intensity > 0) { intensitySum += s.intensity; intensityN++ }
    }
  }
  p.averageIntensity = intensityN ? intensitySum / intensityN : null
  return p
}

function top(counts: Record<string, number>, n = 2): string[] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k)
}

const lower = (list: string[]) => list.map((s) => s.toLowerCase())
const joinAnd = (list: string[]) => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`

export function passesConstraints(s: Session, c: Constraints, ctx: RecommendContext, profile: Profile): boolean {
  const fav = !!ctx.userData[s.id]?.favourite
  if (ctx.userData[s.id]?.excluded) return false
  // Gone from YouTube: still in your history, never proposed.
  if (s.tags.includes('unavailable')) return false
  // A vlog, trailer or pose tutorial isn't a practice to propose.
  if (isExtra(s)) return false
  // Made for women's particular needs: never proposed while the setting is on (the default).
  if (ctx.preferences.skipWomenSpecific !== false && isWomenSpecific(s)) return false
  if (c.maxDuration != null && s.durationMinutes > c.maxDuration) return false
  if (c.minIntensity != null && s.intensity < c.minIntensity) return false
  if (c.maxIntensity != null && (s.intensity === 0 || s.intensity > c.maxIntensity)) return false
  if (c.focus.length && !c.focus.some((f) => s.physicalFocus.includes(f))) return false
  if (c.styles.length && !c.styles.some((f) => s.styles.includes(f))) return false
  if (c.excludeStyles.some((f) => s.styles.includes(f))) return false
  if (c.excludeCompleted && profile.timesPractised[s.id]) return false
  if (c.favourites === 'only' && !fav) return false
  if (c.favourites === 'exclude' && fav) return false
  return true
}

type Scored = { s: Session; w: number; reason: string }

const GENTLE_STYLES = ['Restorative', 'Yin Yoga', 'Gentle Yoga', 'Yoga Nidra', 'Meditation', 'Breathwork']

/** "gentle hips practice for flexibility": what is known about a session, in a few words. */
function describe(s: Session): string {
  const intensity = s.intensity ? INTENSITY_LABELS[s.intensity - 1].toLowerCase() : ''
  const what = s.physicalFocus.length ? lower(s.physicalFocus.slice(0, 2)).join(' and ')
    : s.styles.length ? s.styles[0].toLowerCase() : ''
  const goal = s.objectives[0] ? ` for ${s.objectives[0].toLowerCase()}` : ''
  return `${[intensity, what, 'practice'].filter(Boolean).join(' ')}${goal}`
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
/** "a" or "an", by sound: an upper back practice, a yin yoga practice. */
const an = (phrase: string) => `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`

function scoreMode(mode: SurpriseMode, s: Session, ctx: RecommendContext, p: Profile, c: Constraints): Scored | null {
  const last = p.lastPractised[s.id]
  const since = last ? daysBetween(last, ctx.today) : null
  const rating = ctx.userData[s.id]?.rating ?? 0
  const fav = !!ctx.userData[s.id]?.favourite
  const recentFocus = top(p.focusCounts)
  const recentObjectives = top(p.objectiveCounts)

  switch (mode) {
    case 'random':
      return { s, w: 1, reason: 'Picked at random from everything that fits.' }

    case 'challenge': {
      const strong = s.intensity >= 4 || (s.intensity >= 3 && (s.objectives.includes('Strength') || s.styles.includes('Power Yoga')))
      if (!strong) return null
      return { s, w: s.intensity + (s.objectives.includes('Strength') ? 2 : 0), reason: `${cap(an(describe(s)))}, with real effort in it.` }
    }

    case 'recovery': {
      const gentle = (s.intensity > 0 && s.intensity <= 2) || s.styles.some((x) => GENTLE_STYLES.includes(x)) || s.objectives.includes('Recovery')
      if (!gentle || s.intensity >= 4) return null
      return { s, w: 1 + (s.objectives.includes('Recovery') ? 1 : 0) + (3 - Math.min(s.intensity || 3, 3)), reason: describe(s) === 'practice' ? 'Low effort and kind to the body, for a recovery day.' : `${cap(an(describe(s)))}: low effort and kind to the body.` }
    }

    case 'short': {
      const limit = c.maxDuration ?? 15
      if (s.durationMinutes > limit) return null
      return { s, w: 1 + (fav ? 0.5 : 0) + rating / 5, reason: `${s.durationMinutes} minutes, inside your ${limit}-minute window.` }
    }

    case 'rediscover': {
      if (!fav && !last) return null
      if (since != null && since < 21) return null
      const days = since ?? 60
      return {
        s, w: 1 + Math.min(days, 180) / 30 + rating / 2 + (fav ? 1 : 0),
        reason: last ? `You last practised this ${days} days ago${fav ? ', and it’s one of your favourites' : ''}.` : 'One of your favourites, not yet practised here.',
      }
    }

    case 'different': {
      const usage = s.styles.reduce((sum, x) => sum + (p.allStyleCounts[x] ?? 0), 0)
      const rare = s.styles.filter((x) => !p.allStyleCounts[x])
      const w = 1 / (1 + usage)
      const reason = rare.length
        ? `You haven’t practised ${lower(rare.slice(0, 2)).join(' or ')} in Mat Days yet.`
        : s.styles[0] ? `${s.styles[0]} is a style you come back to less often.` : 'Something you rarely practise, for a change.'
      return { s, w, reason }
    }

    case 'comfort': {
      const familiarity = [...s.styles.map((x) => p.styleCounts[x] ?? 0), ...s.physicalFocus.map((x) => p.focusCounts[x] ?? 0)].reduce((a, b) => a + b, 0)
      const intensityGap = p.averageIntensity != null && s.intensity ? Math.abs(s.intensity - p.averageIntensity) : 1
      const w = (1 + intensityGap) / (1 + familiarity)
      const lean = recentFocus.length ? `Your recent practice has centred on ${joinAnd(lower(recentFocus))}. ` : ''
      return { s, w, reason: `${lean}This ${describe(s)} asks something different of you.` }
    }

    case 'match': {
      let w = 1
      const parts: string[] = []
      const prefs = ctx.preferences
      if (prefs.preferredStyles.some((x) => s.styles.includes(x))) { w += 1.5; parts.push('in a style you like') }
      if (prefs.preferredMaxDuration && s.durationMinutes <= prefs.preferredMaxDuration) { w += 1; parts.push(`within your usual ${prefs.preferredMaxDuration} minutes`) }
      if (prefs.preferredIntensities?.includes(s.intensity)) { w += 1; parts.push('at an intensity you like') }
      const goal = prefs.favouriteGoals?.find((g) => s.objectives.includes(g))
      if (goal) { w += 1; parts.push(`for ${goal.toLowerCase()}, a goal you care about`) }
      if (rating >= 4) { w += rating / 2; parts.push('one you want to repeat') }
      // Variety: lean away from the body areas and aims that dominated the last month.
      const overlap = s.physicalFocus.filter((f) => recentFocus.includes(f)).length + s.objectives.filter((o) => recentObjectives.includes(o)).length
      // Only when the last month has a clear lean to name.
      const leaning = recentObjectives.length > 0 || recentFocus.length > 0
      if (p.recentCount >= 3 && leaning && overlap === 0 && (s.physicalFocus.length || s.objectives.length)) {
        w += 1.5
        const lean = joinAnd(lower([...recentObjectives.slice(0, 1), ...recentFocus.slice(0, 1)]))
        return { s, w, reason: `You’ve been focusing on ${lean} recently. Today: ${an(describe(s))}, for some variety${parts.length ? `, ${parts[0]}` : ''}.` }
      }
      if (overlap > 0 && p.recentCount >= 3) w *= 0.6
      return { s, w, reason: parts.length ? `${cap(an(describe(s)))}, ${joinAnd(parts)}.` : `${cap(an(describe(s)))} that suits today.` }
    }
  }
}

/**
 * Picks one session for `mode`, or returns null when nothing fits. `random`
 * is injectable so tests are deterministic.
 */
export function surprise(
  mode: SurpriseMode, c: Constraints, ctx: RecommendContext, random: () => number = Math.random,
): Pick | null {
  const p = buildProfile(ctx.sessions, ctx.history, ctx.today)
  // Once there's a real library, demo records stop being proposed (they stay browsable).
  const real = ctx.sessions.filter((s) => !s.isDemo)
  const all = real.length >= 10 ? real : ctx.sessions
  const narrowed = ctx.only ? all.filter(ctx.only) : all
  const candidates = narrowed.length ? narrowed : all
  const scored = candidates
    .filter((s) => passesConstraints(s, c, ctx, p))
    .map((s) => scoreMode(mode, s, ctx, p, c))
    .filter((x): x is Scored => !!x && x.w > 0)
  if (!scored.length) return null

  const shown = new Set(ctx.shown)
  const fresh = scored.filter((x) => !shown.has(x.s.id))
  // Once everything has been shown, start the round again rather than dead-end.
  const pool = (fresh.length ? fresh : scored).map((x) => {
    const last = p.lastPractised[x.s.id]
    const since = last ? daysBetween(last, ctx.today) : null
    let w = x.w
    if (mode !== 'rediscover' && since != null && since <= 3) w *= 0.15
    // Rated "once was enough": still possible, rarely proposed.
    if (ctx.userData[x.s.id]?.rating === 1) w *= 0.2
    return { ...x, w }
  })

  const total = pool.reduce((sum, x) => sum + x.w, 0)
  let r = random() * total
  for (const x of pool) {
    r -= x.w
    if (r <= 0) return { session: x.s, reason: x.reason, poolSize: scored.length }
  }
  const lastOne = pool[pool.length - 1]
  return { session: lastOne.s, reason: lastOne.reason, poolSize: scored.length }
}
