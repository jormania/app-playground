// Matches a game title against HowLongToBeat search results the same way
// steamMatch.js matches against Steam's storesearch results — a twin, not a
// shared import, so the two scrapes can drift independently if one site's
// naming quirks ever need different normalization rules. HLTB candidates
// carry a bare `name` (see api/clickdeck-hltb.js's response shape) rather
// than Steam's `.name` on a differently-shaped item, but the scoring logic
// is otherwise identical.
// Space/punctuation-bounded Roman numerals I-XX converted to Arabic digits —
// HLTB and this collection inconsistently use one or the other for the same
// sequel (e.g. "Gabriel Knight 2" here vs. HLTB's own "Gabriel Knight II"),
// and without this the two never overlap enough to clear the confidence
// threshold. Bounded by \b so it can't misfire inside an unrelated word —
// there's no real English word made purely of the letters i/v/x.
const ROMAN_NUMERALS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 }
function convertRomanNumerals(str) {
  return str.replace(/\b[ivx]+\b/g, (match) => {
    const arabic = ROMAN_NUMERALS[match]
    return arabic !== undefined ? String(arabic) : match
  })
}

export function normalizeHltbTitle(name) {
  if (!name) return ''
  let n = name.toLowerCase()
  n = n.replace(/&/g, 'and')
  n = convertRomanNumerals(n)
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
