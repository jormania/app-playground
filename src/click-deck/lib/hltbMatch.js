// Matches a game title against HowLongToBeat search results the same way
// steamMatch.js matches against Steam's storesearch results — a twin, not a
// shared import, so the two scrapes can drift independently if one site's
// naming quirks ever need different normalization rules. HLTB candidates
// carry a bare `name` (see api/clickdeck-hltb.js's response shape) rather
// than Steam's `.name` on a differently-shaped item, but the scoring logic
// is otherwise identical.
export function normalizeHltbTitle(name) {
  if (!name) return ''
  let n = name.toLowerCase()
  n = n.replace(/&/g, 'and')
  n = n.replace(/\b(remastered|remaster|edition|director'?s\s*cut|special|reforged|anniversary|gold|final\s*cut)\b/g, '')
  n = n.replace(/\b\d+(st|nd|rd|th)\b/g, '')
  n = n.replace(/\bthe\b/g, '')
  n = n.replace(/[^a-z0-9]/g, '')
  return n
}

function containmentScore(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (!longer.includes(shorter)) return 0
  return shorter.length / longer.length
}

// Same threshold and rationale as steamMatch.js's CONFIDENCE_THRESHOLD.
const CONFIDENCE_THRESHOLD = 0.5

// Scores every HLTB candidate by normalized-title overlap and returns the
// best one plus whether it clears the confidence bar, so the Editor can warn
// on an unconfident guess instead of silently writing a possibly-wrong
// completion time.
export function findBestHltbMatch(items, title) {
  if (!Array.isArray(items) || items.length === 0) return { match: null, confident: false }
  const target = normalizeHltbTitle(title)
  if (!target) return { match: items[0], confident: false }

  let best = null
  let bestScore = 0
  for (const item of items) {
    const score = containmentScore(target, normalizeHltbTitle(item.name))
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }

  if (best && bestScore >= CONFIDENCE_THRESHOLD) {
    return { match: best, confident: true }
  }
  return { match: items[0], confident: false }
}
