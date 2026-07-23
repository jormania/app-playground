// Shared "fetch this App ID's Steam review summary" helper — one lightweight
// GET, no reverse-engineered handshake (unlike HLTB's real scrape). Used by
// all four server-side fetch sites: the nightly pricing cron, steam-search.js's
// ?appId= mode, clickdeck-studio-search.js, and the flip-time enrichment in
// clickdeckWatchlist.js.
//
// Deliberately its own request, not folded into the appdetails call those
// sites already make — Steam's appdetails endpoint carries no review data at
// all; review summaries live at a completely separate, undocumented endpoint
// (confirmed live July 2026: /appreviews/<appid>?json=1).
//
// Every call site is expected to skip Coming Soon games entirely rather than
// call this for them — verified live that an unreleased game's response is
// `{"review_score_desc":"No user reviews","total_reviews":0}`, structurally
// identical to a released-but-genuinely-unreviewed indie. Calling it for
// Coming Soon rows would be both a wasted request and a source of ambiguity
// this module can't resolve on its own; the "never checked" vs "checked,
// nothing there" distinction only works if callers hold up their end.
export async function fetchReviewSummary(appId) {
  if (!appId) return null
  try {
    const res = await fetch(`https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0&l=english`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.success !== 1 || !data.query_summary) return null

    const { total_reviews, total_positive, review_score_desc } = data.query_summary
    if (!total_reviews) {
      // A real, successful check that just found nothing — still a valid
      // result (not a failure), so callers still stamp Review Checked At.
      return { percent: 0, count: 0, desc: review_score_desc || 'No user reviews' }
    }
    return { percent: (total_positive / total_reviews) * 100, count: total_reviews, desc: review_score_desc || '' }
  } catch (err) {
    return null
  }
}

// Builds the Notion PATCH properties for a resolved review summary. Callers
// only invoke this with a non-null summary (same paired-function convention
// as clickdeckPricing.js's resolvePriceUpdate/buildPatchProperties) — a
// failed fetch (network error, bad response) writes nothing at all, so
// Review Checked At only ever reflects a genuinely successful check.
export function buildReviewPatchProperties(summary, now = new Date()) {
  return {
    'Review Checked At': { date: { start: now.toISOString() } },
    'Steam Review %': { number: summary.percent },
    'Steam Review Desc': { rich_text: summary.desc ? [{ text: { content: summary.desc } }] : [] },
    'Steam Review Count': { number: summary.count }
  }
}

// How often the nightly cron re-checks a Released game's reviews — review
// consensus moves far slower than price, so there's no need to hit every
// game every night the way pricing does (a real Steam-rate-limit/runtime
// concern once this loop already makes one appdetails call per game).
export const REVIEW_RECHECK_DAYS = 7

export function isReviewCheckStale(reviewCheckedAt, now = new Date()) {
  if (!reviewCheckedAt) return true
  const daysSince = (now.getTime() - new Date(reviewCheckedAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= REVIEW_RECHECK_DAYS
}
