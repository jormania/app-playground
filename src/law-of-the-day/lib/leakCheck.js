// Single source of truth for "does the quiz-visible scenario give the answer
// away?" — a scenario must not contain a distinctive word from its own law
// title (or a short inflection of it), or you can guess without reasoning.
//
// Used two ways so the rule can never drift:
//   • data/laws.test.js asserts every static scenario is clean, and
//   • api/generate-law-of-the-day.js rejects any generated scenario that leaks.

// Common function/filler words that appear in titles but carry no giveaway on
// their own. Everything NOT in here (length > 3) is treated as distinctive.
const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'for', 'your', 'you',
  'with', 'be', 'is', 'at', 'as', 'it', 'but', 'not', 'too', 'than', 'each',
  'all', 'do', 'more', 'how', 'use', 'make', 'into', 'never', 'always', 'own',
  'when', 'who', 'from', 'less', 'most', 'man', 'mans', 'act', 'like',
])

const normalize = (word) => word.toLowerCase().replace(/[^a-z]/g, '')

// The distinctive words from a law title that a scenario must avoid.
export function titleLeakWords(title) {
  return [
    ...new Set(
      title
        .split(/\s+/)
        .map(normalize)
        .filter((w) => w.length > 3 && !STOP.has(w)),
    ),
  ]
}

// Returns the distinctive title words the scenario leaks (empty array = clean).
// Matches a title word plus up to 3 trailing letters, so "stop" also catches
// "stops"/"stopped" and "commit" catches "commits".
export function scenarioLeaksTitle(scenarioText, title) {
  const haystack = ' ' + scenarioText.toLowerCase() + ' '
  return titleLeakWords(title).filter((w) =>
    new RegExp(`\\b${w}[a-z]{0,3}\\b`).test(haystack),
  )
}
