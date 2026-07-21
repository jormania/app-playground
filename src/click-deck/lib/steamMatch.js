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

// Picks the best candidate from a Steam storesearch `items` array for the
// given title, preferring one whose normalized name contains (or is
// contained by) the normalized target — the same "is_similar" substring
// heuristic verify-steam-names.py uses to flag mismatches. Falls back to the
// first result only when nothing matches with any confidence, so a generic
// query still resolves to *something* rather than silently doing nothing.
export function pickBestSteamMatch(items, title) {
  if (!Array.isArray(items) || items.length === 0) return null
  const target = normalizeSteamTitle(title)
  if (!target) return items[0]
  const confident = items.find(item => {
    const n = normalizeSteamTitle(item.name)
    return n && (n.includes(target) || target.includes(n))
  })
  return confident || items[0]
}
