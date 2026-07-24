// Shared Steam review-rating logic — the confidence-adjusted rank score,
// the display buckets, and the "never checked" vs "checked, nothing there"
// distinction. Used by [T]'s sort, [A]'s filter row, [S]'s consensus panel,
// [R]'s weighting mode, and the Timeline card badge, so none of them can
// disagree about what a game's Steam rating actually is.

// 95%-confidence z-score for a Wilson score interval lower bound — the same
// "we know the %, but how sure are we" technique behind Reddit's "best"
// comment sort. Deliberately the well-tested standard for exactly this
// "% positive vs. sample size" problem rather than a hand-tuned formula: a
// game with 100% positive from 4 reviews should NOT outrank one with 94%
// positive from 50,000, and this is what keeps that from happening without
// any magic constants to tune.
const Z = 1.96

// percentPositive is 0-100 (Steam's own display percentage); reviewCount is
// the sample size. Returns null when there's nothing to compute from (no
// reviews at all) rather than 0, so callers can tell "no data" apart from
// "confidently rated at the bottom".
export function wilsonLowerBound(percentPositive, reviewCount) {
  if (!reviewCount || reviewCount <= 0) return null
  const p = percentPositive / 100
  const n = reviewCount
  const z2 = Z * Z
  const denominator = 1 + z2 / n
  const centre = p + z2 / (2 * n)
  const margin = Z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  return Math.max(0, Math.min(1, (centre - margin) / denominator))
}

// A game's confidence-adjusted review score (0-1), or null when there's
// nothing to rank by (never checked, or checked and Steam reported zero
// reviews). This — NOT the raw percentage — is what [R]'s weighting and
// [T]'s "Steam Rating" sort key off, so a tiny-sample fluke can't outrank an
// established classic. [A]'s filter buckets deliberately use the raw
// percentage instead (see reviewBucketOf) — that's the number the badge
// actually displays, so filtering matches what's on screen.
export function steamReviewScore(game) {
  if (!hasReviewData(game)) return null
  return wilsonLowerBound(game.steamReviewPercent, game.steamReviewCount)
}

// `Review Checked At` is stamped on every successful fetch attempt,
// regardless of outcome — same "did we check" vs "did we find something"
// split as `Price Updated At`. A game that predates this feature (or whose
// fetch hasn't run yet) has this undefined/null.
export function wasReviewChecked(game) {
  return Boolean(game && game.reviewCheckedAt)
}

// True only once Steam has actually reported at least one review for this
// game. A Coming Soon title or a genuinely under-the-radar release both
// come back from Steam as zero reviews — structurally identical to "never
// checked" unless this distinction is kept, which is why `reviewCheckedAt`
// exists as a separate field from the count itself.
export function hasReviewData(game) {
  return wasReviewChecked(game) && typeof game.steamReviewCount === 'number' && game.steamReviewCount > 0
}

// Buckets keyed off Steam's OWN descriptor string (steamReviewDesc), never
// re-derived from the percentage. Percentage-threshold bucketing was tried
// first and confirmed broken live: Valve's real tier boundaries aren't a
// clean function of percentage alone (review count factors in too), so two
// games Steam itself both calls "Very Positive" can sit at, say, 80% and
// 91% — different percentage-threshold buckets, different colours, for
// what Steam calls the identical verdict. Keying off the string Steam
// already computed sidesteps the whole problem: identical label, identical
// bucket, always, no threshold math to disagree with reality.
// Mirrors LENGTH_BUCKETS' one-word-label shape.
export const REVIEW_BUCKETS = {
  Acclaimed: { label: 'Acclaimed', desc: ['Overwhelmingly Positive', 'Very Positive'] },
  Positive: { label: 'Positive', desc: ['Positive', 'Mostly Positive'] },
  Mixed: { label: 'Mixed', desc: ['Mixed'] },
  Negative: { label: 'Negative', desc: ['Mostly Negative', 'Negative', 'Very Negative', 'Overwhelmingly Negative'] }
}

const DESC_TO_BUCKET = Object.fromEntries(
  Object.entries(REVIEW_BUCKETS).flatMap(([bucket, { desc }]) => desc.map(d => [d, bucket]))
)

export function reviewBucketOf(desc) {
  return DESC_TO_BUCKET[desc] || null
}

export function isInReviewBucket(game, bucket) {
  if (!hasReviewData(game)) return false
  return reviewBucketOf(game.steamReviewDesc) === bucket
}

// Colour accent for the [T] badge — reuses the current theme's own accent
// vocabulary (cyan/amber/muted/danger-red) rather than a literal Steam-style
// green-to-red gradient, which would clash badly across this app's 6
// palettes (a hardcoded green is the one thing that doesn't belong in
// grayscale Noir, cyan/magenta CGA, or monochrome Amber Terminal). Same
// convention as studios-connector.js's tierAccentColor: bucket by strength,
// let the active theme decide what each bucket actually looks like.
// Deliberately NOT cyan-for-Acclaimed/amber-for-Positive/muted-for-Mixed —
// amber is reserved for Mixed (the tier worth a second look) and Positive
// fades to muted (solid but unremarkable), per explicit design direction.
export function reviewAccentColor(desc) {
  const bucket = reviewBucketOf(desc)
  if (bucket === 'Acclaimed') return 'var(--cd-accent-cyan)'
  if (bucket === 'Positive') return 'var(--cd-text-muted)'
  if (bucket === 'Mixed') return 'var(--cd-accent-amber)'
  if (bucket === 'Negative') return 'var(--cd-status-abandoned)'
  return 'var(--cd-text-muted)'
}
