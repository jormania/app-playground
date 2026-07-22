// Matches a game title against Steam storesearch results with a bit of
// normalization, instead of blindly trusting whatever Steam's fuzzy relevance
// ranking puts first. Classic titles are frequently re-listed on Steam with a
// "Remastered" / "Special Edition" / "Anniversary Edition" / "The Final Cut"
// suffix, which a plain-string compare would treat as a non-match — this
// strips that class of noise before comparing. Mirrors the normalization
// already used (read-only) by scripts/verify-steam-names.py, so the two stay
// in agreement about what counts as "the same game."
export function normalizeSteamTitle(name) {
  if (!name) return ''
  let n = name.toLowerCase()
  n = n.replace(/&/g, 'and')
  n = n.replace(/\b(remastered|remaster|edition|director'?s\s*cut|special|reforged|anniversary|gold|final\s*cut)\b/g, '')
  // "20th Anniversary Edition", "25th Anniversary" etc. — drop the ordinal too.
  n = n.replace(/\b\d+(st|nd|rd|th)\b/g, '')
  // Strip "the" as a standalone word anywhere, not just a leading article —
  // re-releases often insert it mid-title, e.g. "Disco Elysium - The Final Cut".
  n = n.replace(/\bthe\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')
  return n
}

// How much of the longer normalized string the shorter one actually covers.
// 1.0 = identical (after normalization). A bare "one contains the other"
// check treats a 3-character title like "Dig" as equally confident whether
// it's matched against "The Dig" (score 1.0) or a totally unrelated game
// like "Digimon Survive" that just happens to start with the same letters
// (score 3/14 ≈ 0.21) — this ratio is what tells those two apart.
function containmentScore(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (!longer.includes(shorter)) return 0
  return shorter.length / longer.length
}

// Below this overlap ratio, a "contains" hit is more likely a coincidental
// substring than the actual game — short/generic titles ("Loom", "The Dig",
// "Norco") are the ones most at risk of matching an unrelated Steam listing
// this way. Tuned loose enough to still accept legitimate long-subtitle
// re-releases the suffix-stripping in normalizeSteamTitle doesn't catch.
const CONFIDENCE_THRESHOLD = 0.5

// Scores every candidate by normalized-title overlap and returns the best
// one, plus whether it actually clears the confidence bar — so callers can
// tell a verified match apart from a best-effort guess and warn the user
// instead of silently writing a possibly-wrong Steam App ID. Previously this
// picked the *first* item satisfying a loose "contains" check in whatever
// order Steam's search happened to return them, which meant an unconfident
// coincidental match earlier in the list could beat a confident exact match
// later in it.
export function findBestSteamMatch(items, title) {
  if (!Array.isArray(items) || items.length === 0) return { match: null, confident: false }
  const target = normalizeSteamTitle(title)
  if (!target) return { match: items[0], confident: false }

  let best = null
  let bestScore = 0
  for (const item of items) {
    const score = containmentScore(target, normalizeSteamTitle(item.name))
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }

  if (best && bestScore >= CONFIDENCE_THRESHOLD) {
    return { match: best, confident: true }
  }
  // Nothing cleared the bar — fall back to Steam's own top relevance result
  // rather than returning nothing, but flag it as unconfident so the caller
  // can ask for a manual check instead of treating it as verified.
  return { match: items[0], confident: false }
}

// Back-compat wrapper for callers that only need the chosen item (or null
// for an empty result set) and don't care about the confidence flag.
export function pickBestSteamMatch(items, title) {
  return findBestSteamMatch(items, title).match
}
