/**
 * Three things Nora could wear today.
 *
 * This is the whole product, and it is deliberately the least clever code in
 * the app: a pure function, no AI, no network, no randomness. That buys four
 * things the charter actually asks for — it's instant, it works offline, it can
 * be unit-tested, and it can always explain itself. An LLM here would cost all
 * four and gain nothing a teenager would notice.
 *
 * Scoring is a small pile of readable rules rather than tuned weights. When a
 * suggestion looks wrong, the fix should be obvious from reading this file.
 */
import type { Condition } from '../../shared/weather.ts'
import type { Garment } from './types.ts'
import type { Mood, Style, Warmth } from './vocabulary.ts'

export interface RecommendContext {
  /** °C. Null when weather is unavailable — scoring then ignores warmth. */
  temp: number | null
  condition: Condition
  /** km/h. */
  wind: number
  mood: Mood | null
  /** YYYY-MM-DD, for the recency penalty. */
  today: string
}

export interface OutfitSuggestion {
  /** Stable across renders: derived from the garment ids it contains. */
  id: string
  garments: Garment[]
  score: number
  /** One plain sentence. Nora should always be able to ask "why this?" */
  why: string
}

// ── Weather → what to aim for ───────────────────────────────────────────────

/** The warmth a garment should ideally be for this temperature. */
export function targetWarmth(temp: number | null): Warmth | null {
  if (temp === null) return null
  if (temp >= 22) return 'Light'
  if (temp >= 12) return 'Mid'
  return 'Warm'
}

const WARMTH_ORDER: Warmth[] = ['Light', 'Mid', 'Warm']

/** Rain, snow and storms all mean "you will get wet". */
export function isWet(condition: Condition): boolean {
  return condition === 'rain' || condition === 'snow' || condition === 'thunder'
}

// ── Mood → the styles it favours ────────────────────────────────────────────

const MOOD_STYLES: Record<Mood, Style[]> = {
  Comfy: ['cosy', 'casual'],
  Confident: ['going-out', 'smart'],
  Sporty: ['sporty', 'casual'],
  Cosy: ['cosy', 'layering'],
  'Put-together': ['smart', 'school'],
  'Low-key': ['casual', 'school'],
}

/** Colours that sit happily beside anything else. */
const NEUTRALS = new Set(['black', 'white', 'grey', 'navy', 'beige', 'cream', 'denim'])

// ── Scoring one garment ─────────────────────────────────────────────────────

export interface ScoreBreakdown {
  total: number
  reasons: string[]
}

/**
 * How well this garment suits today. Higher is better; negatives are allowed
 * so a genuinely wrong choice (a puffer coat in July) sinks rather than merely
 * ranking low.
 */
export function scoreGarment(garment: Garment, ctx: RecommendContext): ScoreBreakdown {
  let total = 0
  const reasons: string[] = []

  // Warmth against temperature — the single strongest signal, because getting
  // this wrong is the one mistake you feel all day.
  const target = targetWarmth(ctx.temp)
  if (target && garment.warmth) {
    const distance = Math.abs(WARMTH_ORDER.indexOf(garment.warmth) - WARMTH_ORDER.indexOf(target))
    if (distance === 0) {
      total += 3
      reasons.push('right for the temperature')
    } else if (distance === 1) {
      total += 1
    } else {
      total -= 4
    }
  }

  // Mood.
  if (ctx.mood) {
    const wanted = MOOD_STYLES[ctx.mood]
    const hits = garment.styles.filter((s) => wanted.includes(s))
    if (hits.length > 0) {
      total += 2 * Math.min(hits.length, 2)
      reasons.push(`feels ${ctx.mood.toLowerCase()}`)
    }
  }

  // Weather beyond temperature.
  if (isWet(ctx.condition)) {
    if (garment.category === 'Outerwear') { total += 2; reasons.push('keeps the rain off') }
    if (garment.styles.includes('summery')) total -= 2
  }
  if (ctx.condition === 'clear' && (ctx.temp ?? 0) >= 22 && garment.styles.includes('summery')) {
    total += 1
  }
  if (ctx.wind >= 30 && garment.styles.includes('layering')) total += 1

  // Favourites, gently. Enough to break a tie, never enough to override the
  // weather — a favourite T-shirt should not win in February.
  if (garment.favourite) { total += 1; reasons.push('one of your favourites') }

  // Recency: nudge away from what was just worn, without banning it.
  const days = daysSince(garment.lastWorn, ctx.today)
  if (days !== null) {
    if (days <= 1) total -= 3
    else if (days <= 3) total -= 1
    else if (days >= 30) { total += 1; reasons.push("you haven't worn it in ages") }
  }

  return { total, reasons }
}

/** Whole days between an ISO date and today, or null. Built from parts, never
 *  Date.parse of the raw string, which reads it as UTC and lands a day out. */
export function daysSince(isoDate: string | null, today: string): number | null {
  const a = parseIso(isoDate)
  const b = parseIso(today)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function parseIso(value: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// ── Building outfits ────────────────────────────────────────────────────────

/** Neutral-heavy outfits read as "put together"; three strong colours rarely do. */
function colourHarmony(garments: Garment[]): number {
  const strong = new Set<string>()
  for (const g of garments) {
    for (const c of g.colours) if (!NEUTRALS.has(c)) strong.add(c)
  }
  if (strong.size <= 1) return 1
  if (strong.size === 2) return 0
  return -2
}

/**
 * How strongly to avoid reusing a garment already seen in an earlier
 * suggestion. Big enough to prefer a different pair of shoes whenever one
 * exists, small enough that it can't force a genuinely wrong choice (opposite
 * warmth costs -4 and still loses to this).
 */
const REPEAT_PENALTY = 6

/**
 * Best-scoring garment of a category, excluding anything already in this
 * outfit and discouraging anything used by a previous suggestion.
 *
 * Discouraged rather than excluded on purpose: with one pair of shoes in the
 * wardrobe, repeating them beats offering outfits with no shoes at all.
 */
function pick(
  garments: Garment[],
  category: Garment['category'],
  ctx: RecommendContext,
  used: Set<string>,
  discouraged: Set<string> = new Set(),
): Garment | null {
  const options = garments
    .filter((g) => g.category === category && !used.has(g.id))
    .map((g) => ({
      g,
      s: scoreGarment(g, ctx).total - (discouraged.has(g.id) ? REPEAT_PENALTY : 0),
    }))
    // Ties break on id so the same inputs always give the same outfit.
    .sort((a, b) => b.s - a.s || a.g.id.localeCompare(b.g.id))
  return options[0]?.g ?? null
}

/**
 * Build up to `count` outfits.
 *
 * Greedy with an anchor: each round picks the best available Top or Dress, then
 * builds around it, then removes that anchor so the next suggestion is visibly
 * different. Three variations on the same shirt would technically score well
 * and be useless.
 */
export function recommend(
  garments: Garment[],
  ctx: RecommendContext,
  count = 3,
): OutfitSuggestion[] {
  const wearable = garments.filter((g) => !g.archived)
  const suggestions: OutfitSuggestion[] = []
  const usedAnchors = new Set<string>()
  // Everything any earlier suggestion used. Three outfits sharing one pair of
  // shoes technically score well and read as the app repeating itself.
  const seenBefore = new Set<string>()

  for (let round = 0; round < count; round++) {
    const used = new Set(usedAnchors)

    const top = pick(wearable, 'Top', ctx, used)
    const dress = pick(wearable, 'Dress', ctx, used)

    // Whichever anchor scores better. A dress is a complete outfit on its own,
    // so it competes with the top+bottom pair rather than joining it.
    const topScore = top ? scoreGarment(top, ctx).total : -Infinity
    const dressScore = dress ? scoreGarment(dress, ctx).total : -Infinity

    const chosen: Garment[] = []
    let anchor: Garment | null = null

    if (dress && dressScore >= topScore) {
      anchor = dress
      chosen.push(dress)
    } else if (top) {
      anchor = top
      chosen.push(top)
      used.add(top.id)
      const bottom = pick(wearable, 'Bottom', ctx, used, seenBefore)
      // A top with nothing to wear it with is not an outfit.
      if (!bottom) break
      chosen.push(bottom)
    } else {
      break
    }

    if (!anchor) break
    usedAnchors.add(anchor.id)
    for (const g of chosen) used.add(g.id)

    const shoes = pick(wearable, 'Shoes', ctx, used, seenBefore)
    if (shoes) { chosen.push(shoes); used.add(shoes.id) }

    // Outerwear only when it earns its place.
    const needsCoat = isWet(ctx.condition) || (ctx.temp !== null && ctx.temp < 14) || ctx.wind >= 35
    if (needsCoat) {
      const coat = pick(wearable, 'Outerwear', ctx, used, seenBefore)
      if (coat) { chosen.push(coat); used.add(coat.id) }
    }

    const score =
      chosen.reduce((sum, g) => sum + scoreGarment(g, ctx).total, 0) / chosen.length +
      colourHarmony(chosen)

    for (const g of chosen) seenBefore.add(g.id)

    suggestions.push({
      id: chosen.map((g) => g.id).sort().join('+'),
      garments: chosen,
      score: Math.round(score * 100) / 100,
      why: explain(chosen, ctx),
    })
  }

  return suggestions
}

/**
 * One plain sentence about why this outfit. Assembled from the same reasons the
 * scorer produced, so the explanation can never disagree with the score.
 */
export function explain(garments: Garment[], ctx: RecommendContext): string {
  const seen = new Set<string>()
  for (const g of garments) {
    for (const r of scoreGarment(g, ctx).reasons) seen.add(r)
  }
  const reasons = [...seen].slice(0, 2)
  if (reasons.length === 0) return 'A simple option for today.'
  if (reasons.length === 1) return capitalise(reasons[0]) + '.'
  return `${capitalise(reasons[0])}, and ${reasons[1]}.`
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
