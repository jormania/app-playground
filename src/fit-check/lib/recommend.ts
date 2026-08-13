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
  /** YYYY-MM-DD, for the recency penalty and the daily shuffle. */
  today: string
  /**
   * Bumped by "Show me something else". Part of the shuffle seed, so a tap
   * reshuffles the ties without making anything here random — same inputs
   * still give the same outfits.
   */
  variety?: number
  /**
   * Combinations not to offer: already worn or skipped today, or already put
   * up and passed over this session. Honoured unless honouring it would leave
   * nothing at all — see `recommend`.
   */
  avoidIds?: string[]
}

export interface OutfitSuggestion {
  /**
   * Derived from the garment ids it contains, so it changes when a piece is
   * swapped. That's deliberate: a swapped outfit IS a different outfit, and
   * `verdicts` is keyed by this — wearing one combination shouldn't mark a
   * different one as worn.
   */
  id: string
  /**
   * Which of the three cards this is (0, 1, 2). Unlike `id`, it survives a
   * Quick Swap — so React keys off this and the card doesn't remount (and
   * visibly flicker its photos) every time a piece changes.
   */
  slot: number
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

// ── The daily shuffle ───────────────────────────────────────────────────────

/**
 * Nora's actual complaint about this engine was that it kept saying the same
 * thing. It wasn't broken — it was *too* deterministic. Every other rule here
 * scores in whole numbers, so a wardrobe throws up ties constantly (three Mid
 * casual tops in October score identically), and ties broke on `id`
 * alphabetically. The alphabetically-first garment therefore won every tie,
 * every day, forever.
 *
 * The fix is not randomness — that would cost the four things this file exists
 * to keep (instant, offline, testable, explicable). It's a wider *seed*: the
 * date is already an input, so hashing it with the garment id gives a stable
 * per-day offset. Same day, same wardrobe, same weather ⇒ still exactly the
 * same answer; tomorrow ⇒ a different tie-break.
 *
 * Deliberately in [0, 1), strictly less than the smallest real signal. It can
 * reorder garments the scorer considers EQUAL and nothing else — it can never
 * put a puffer coat on in July, and there's a test saying so.
 */
export function shuffle(garmentId: string, ctx: RecommendContext): number {
  // FNV-1a, 32-bit. Any cheap avalanche would do; this one is four lines and
  // has no dependencies.
  let hash = 0x811c9dc5
  const seed = `${garmentId}|${ctx.today}|${ctx.variety ?? 0}`
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return ((hash >>> 0) % 10000) / 10000
}

/**
 * The parts of the weather that can actually change a suggestion — every
 * threshold this file tests against, and nothing else.
 *
 * Today rebuilds its cards when this changes rather than when the raw reading
 * does, so a refresh drifting 20.1°C → 20.3°C doesn't reshuffle the screen
 * (and doesn't strand a "Worn today" confirmation on a card that vanishes).
 */
export function weatherKey(ctx: RecommendContext): string {
  const bands = ctx.temp === null
    ? 'x'
    : [22, 14, 12, 8].map((edge) => (ctx.temp! < edge ? '1' : '0')).join('')
  const winds = [25, 30, 35].map((edge) => (ctx.wind >= edge ? '1' : '0')).join('')
  return `${bands}|${winds}|${ctx.condition}`
}

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

  // Recency: nudge away from what was just worn, without banning it. The
  // window used to be three days, which meant anything worn on Monday was back
  // in the running by Thursday and the same few garments circled all week — a
  // wardrobe holds more than three days of clothes, so the penalty now reaches
  // across one. `days <= 0` also catches a lastWorn in the future, which a
  // clock change or a hand-edited Notion row can produce.
  const days = daysSince(garment.lastWorn, ctx.today)
  if (days !== null) {
    if (days <= 0) total -= 4
    else if (days <= 2) total -= 3
    else if (days <= 6) total -= 1
    else if (days >= 30) { total += 1; reasons.push("you haven't worn it in ages") }
  }

  // Last, and always smaller than everything above it: the daily tie-break.
  // See `shuffle` — this only ever separates garments that are otherwise level.
  total += shuffle(garment.id, ctx)

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
 * An outfit's identity: its garment ids, sorted so the same set always yields
 * the same id regardless of the order pieces were chosen or swapped in.
 *
 * Exported in id form as well, because a history row stores the same set as a
 * plain `garmentIds` array — matching "did I already wear this today?" against
 * a suggestion means both sides must compute the key the same way, and two
 * copies of a one-line join is exactly how they'd drift.
 */
export function outfitKey(garmentIds: string[]): string {
  return [...garmentIds].sort().join('+')
}

function outfitId(garments: Garment[]): string {
  return outfitKey(garments.map((g) => g.id))
}

/**
 * Should this outfit carry an accessory?
 *
 * Accessories are optional by nature, which is why nothing chose them before
 * now: a scarf on a freezing day is genuinely part of the outfit, a tote on a
 * Tuesday is just a tote. So one is added only when it earns its place —
 * something warm when it's actually cold or blowing a gale, or anything that
 * speaks to a mood Nora deliberately picked.
 */
function accessoryEarnsIts(garment: Garment, ctx: RecommendContext): boolean {
  const cold = ctx.temp !== null && ctx.temp < 8
  if ((cold || ctx.wind >= 25) && garment.warmth === 'Warm') return true
  if (ctx.mood) {
    const wanted = MOOD_STYLES[ctx.mood]
    if (garment.styles.some((s) => wanted.includes(s))) return true
  }
  return false
}

/**
 * How covered an outfit is, for ordering the cards.
 *
 * Only "is there something on your feet" — outerwear and accessories are
 * situational, so an outfit doesn't become *more* complete by needing a coat.
 * This replaces a plain garment-count sort, which let a four-piece mediocre
 * outfit lead over a three-piece excellent one purely by being longer.
 */
function coverage(outfit: OutfitSuggestion): number {
  return outfit.garments.some((g) => g.category === 'Shoes') ? 1 : 0
}

/**
 * How good an outfit is as a whole — the mean of its pieces, plus a nudge for
 * colour harmony. Shared by `recommend` and `swapPiece` so a swapped outfit is
 * scored on exactly the same terms as a generated one.
 */
function scoreOutfit(garments: Garment[], ctx: RecommendContext): number {
  if (garments.length === 0) return 0
  const mean = garments.reduce((sum, g) => sum + scoreGarment(g, ctx).total, 0) / garments.length
  return Math.round((mean + colourHarmony(garments)) * 100) / 100
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
  const wearable = garments.filter((g) => !g.archived && !g.retired)

  const avoid = new Set(ctx.avoidIds ?? [])
  let suggestions = build(wearable, ctx, count, avoid)
  // Never leave her staring at nothing. If everything her wardrobe can make is
  // something she already answered today, offering it again beats an empty
  // screen — the same call this file already makes about a single pair of
  // shoes (repeat them rather than suggest going barefoot).
  if (suggestions.length === 0 && avoid.size > 0) {
    suggestions = build(wearable, ctx, count, new Set())
  }

  // Best first. Coverage leads only where it genuinely differs — a shoeless
  // outfit shouldn't head the list — and among outfits that cover the same
  // ground the score decides, which is what "best" is supposed to mean.
  suggestions.sort((a, b) => coverage(b) - coverage(a) || b.score - a.score)
  suggestions.forEach((s, i) => { s.slot = i })

  return suggestions
}

/** One pass of the greedy builder. Split out so `recommend` can run it twice —
 *  once honouring `avoid`, once without, when the first pass came up empty. */
function build(
  wearable: Garment[],
  ctx: RecommendContext,
  count: number,
  avoid: Set<string>,
): OutfitSuggestion[] {
  const suggestions: OutfitSuggestion[] = []
  const usedAnchors = new Set<string>()
  // Everything any earlier suggestion used. Three outfits sharing one pair of
  // shoes technically score well and read as the app repeating itself.
  const seenBefore = new Set<string>()

  // Each pass consumes exactly one anchor, so this ends when the wardrobe runs
  // out of tops and dresses — not after a fixed number of rounds. That matters
  // now that a round can be discarded (already answered today) without
  // producing a card.
  while (suggestions.length < count) {
    const used = new Set(usedAnchors)

    const top = pick(wearable, 'Top', ctx, used)
    const dress = pick(wearable, 'Dress', ctx, used)
    // A top with nothing to wear it with is not an outfit — and it isn't a
    // reason to stop either. This used to `break`, which meant a wardrobe of
    // dresses and one lonely top returned NOTHING whenever the top happened to
    // outscore the dresses.
    const bottom = top ? pick(wearable, 'Bottom', ctx, new Set(used).add(top.id), seenBefore) : null

    // Whichever anchor scores better. A dress is a complete outfit on its own,
    // so it competes with the top+bottom pair rather than joining it.
    const topScore = top && bottom ? scoreGarment(top, ctx).total : -Infinity
    const dressScore = dress ? scoreGarment(dress, ctx).total : -Infinity

    let anchor: Garment
    let chosen: Garment[]
    if (dress && dressScore >= topScore) {
      anchor = dress
      chosen = [dress]
    } else if (top && bottom) {
      anchor = top
      chosen = [top, bottom]
    } else {
      break
    }

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

    // And an accessory, on the same terms — but *excluded* after one use
    // rather than merely discouraged. The one pair of shoes in the wardrobe is
    // still worth repeating across all three cards; the one scarf is not,
    // because an outfit without an accessory is a complete outfit and three
    // cards wearing the same scarf just look copy-pasted.
    const accessories = wearable.filter((g) => accessoryEarnsIts(g, ctx))
    const spent = new Set([...used, ...seenBefore])
    const extra = pick(accessories, 'Accessory', ctx, spent)
    if (extra) { chosen.push(extra); used.add(extra.id) }

    const id = outfitId(chosen)
    // Already worn or skipped today, or already shown and passed over. Skip it
    // without recording its pieces as "seen" — it isn't on screen, so it has no
    // claim on the shoes.
    if (avoid.has(id)) continue

    for (const g of chosen) seenBefore.add(g.id)

    suggestions.push({
      slot: 0, // Assigned once the whole set is sorted.
      id,
      garments: chosen,
      score: scoreOutfit(chosen, ctx),
      why: explain(chosen, ctx),
    })
  }

  return suggestions
}

// ── Quick Swap ──────────────────────────────────────────────────────────────

/**
 * Every garment that could stand in for `garmentId` in this outfit, best first,
 * INCLUDING the one currently in place.
 *
 * Same-category only. Swapping a Dress for a Top would restructure the outfit
 * (a dress is a complete outfit; a top needs a bottom), which is a different
 * and much larger feature — "change the shoes" is the actual ask.
 *
 * Including the current garment is what makes `swapPiece` able to cycle without
 * the UI tracking an index: the list is a ring, and stepping off the end lands
 * back where it started.
 */
export function alternativesFor(
  outfit: OutfitSuggestion,
  garmentId: string,
  wardrobe: Garment[],
  ctx: RecommendContext,
): Garment[] {
  const current = outfit.garments.find((g) => g.id === garmentId)
  if (!current) return []
  const inOutfit = new Set(outfit.garments.map((g) => g.id))
  return wardrobe
    .filter((g) => !g.archived && !g.retired)
    .filter((g) => g.category === current.category)
    // Everything else already in this outfit is unavailable — but the piece
    // being replaced stays in the ring.
    .filter((g) => g.id === current.id || !inOutfit.has(g.id))
    .sort((a, b) =>
      scoreGarment(b, ctx).total - scoreGarment(a, ctx).total || a.id.localeCompare(b.id))
}

/**
 * Swap one piece for the next-best alternative, keeping everything else
 * exactly as it is — "this outfit, but different shoes".
 *
 * Cycles: repeated calls walk the ranked ring of same-category garments and
 * eventually return to the original, so a swap is always undoable by tapping
 * again rather than needing an undo button.
 *
 * Returns the outfit unchanged when there's nothing to swap to, so the caller
 * never has to special-case a one-pair-of-shoes wardrobe.
 */
export function swapPiece(
  outfit: OutfitSuggestion,
  garmentId: string,
  wardrobe: Garment[],
  ctx: RecommendContext,
): OutfitSuggestion {
  const ring = alternativesFor(outfit, garmentId, wardrobe, ctx)
  if (ring.length <= 1) return outfit

  const currentIndex = ring.findIndex((g) => g.id === garmentId)
  if (currentIndex === -1) return outfit
  const next = ring[(currentIndex + 1) % ring.length]

  // Position is preserved, so the outfit doesn't visually reshuffle around the
  // piece that changed.
  const garments = outfit.garments.map((g) => (g.id === garmentId ? next : g))
  return {
    ...outfit,
    id: outfitId(garments),
    garments,
    score: scoreOutfit(garments, ctx),
    why: explain(garments, ctx),
  }
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
