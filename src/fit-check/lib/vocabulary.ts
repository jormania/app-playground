/**
 * The closed vocabulary. Read this before touching tagging.
 *
 * Notion `select` and `multi_select` properties are CLOSED: writing an option
 * that isn't already registered on the database returns 400 and **rejects the
 * entire property patch atomically** — every other field in that same write
 * fails silently alongside it. (Learned the hard way on Click Deck.)
 *
 * That is a manageable risk when a human picks from a dropdown. It is a serious
 * one here, because Fit Check's tags are AI-assigned and a model asked to name a
 * colour will happily answer "dusty rose". So this module is the single source
 * of truth, used three ways:
 *
 *   1. it defines the options registered on the Notion databases,
 *   2. it is injected into the tagging prompt as the only permitted answers,
 *   3. every value is validated against it here, client-side, before any write.
 *
 * Layer 3 is what actually saves us — a prompt is a request, not a guarantee.
 *
 * Changing the vocabulary: add the option in Notion FIRST, then here. The
 * reverse order writes an unregistered option and takes the patch down.
 */

export const CATEGORIES = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Accessory'] as const
export type Category = (typeof CATEGORIES)[number]

export const COLOURS = [
  'black', 'white', 'grey', 'navy', 'blue', 'green', 'red', 'pink',
  'purple', 'yellow', 'orange', 'brown', 'beige', 'cream', 'denim', 'multicolour',
] as const
export type Colour = (typeof COLOURS)[number]

export const WARMTHS = ['Light', 'Mid', 'Warm'] as const
export type Warmth = (typeof WARMTHS)[number]

export const STYLES = [
  'casual', 'sporty', 'smart', 'cosy', 'going-out', 'school', 'summery', 'layering',
] as const
export type Style = (typeof STYLES)[number]

/**
 * Stable keys, never shown raw to Nora. She renames the homes in Settings and
 * the app maps key → display name (see lib/config.ts). Renaming the Notion
 * option itself would orphan every row already referencing it — the same
 * closed-vocabulary hazard from a different direction.
 */
export const HOMES = ['Home A', 'Home B', 'Both'] as const
export type Home = (typeof HOMES)[number]

export const MOODS = ['Comfy', 'Confident', 'Sporty', 'Cosy', 'Put-together', 'Low-key'] as const
export type Mood = (typeof MOODS)[number]

export const VERDICTS = ['Worn', 'Skipped'] as const
export type Verdict = (typeof VERDICTS)[number]

/** Is `value` a registered option of `list`? */
export function isKnown<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

/**
 * Narrow one value to a registered option, or `null`.
 *
 * `null` means "leave the property unset", which Notion always accepts. Never
 * fall back to an arbitrary default — a garment silently tagged `Top` because
 * the model said `Blouse` is worse than one left untagged for Nora to fix.
 */
export function coerceOne<T extends string>(list: readonly T[], value: unknown): T | null {
  if (isKnown(list, value)) return value
  // Models vary the casing more than the word ("Casual" vs "casual"). Matching
  // case-insensitively rescues a genuinely correct answer; it never invents one.
  if (typeof value === 'string') {
    const hit = list.find((opt) => opt.toLowerCase() === value.trim().toLowerCase())
    if (hit) return hit
  }
  return null
}

/**
 * Filter a list down to registered options, dropping everything else and
 * de-duplicating. This is the last line of defence before a multi_select write.
 */
export function coerceMany<T extends string>(list: readonly T[], values: unknown): T[] {
  if (!Array.isArray(values)) return []
  const out: T[] = []
  for (const raw of values) {
    const one = coerceOne(list, raw)
    if (one && !out.includes(one)) out.push(one)
  }
  return out
}

/**
 * The vocabulary rendered for the tagging prompt. Generated rather than written
 * out by hand so the prompt can never drift from what Notion will accept —
 * drift here is exactly the failure this module exists to prevent.
 */
export function vocabularyForPrompt(): string {
  return [
    `Category (choose exactly one): ${CATEGORIES.join(', ')}`,
    `Colours (choose one to three): ${COLOURS.join(', ')}`,
    `Warmth (choose exactly one): ${WARMTHS.join(', ')}`,
    `Style (choose one to three): ${STYLES.join(', ')}`,
  ].join('\n')
}
