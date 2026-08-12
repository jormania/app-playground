/**
 * The one implementation of Wordle tile scoring.
 *
 * This used to live in three places — Board's (correct) two-pass version, the share
 * card's naive `word.includes(letter)` version, and the keyboard's own copy — which had
 * quietly drifted apart. The share card's copy skipped the consumption step, so a guess
 * repeating a letter the answer has fewer of rendered extra yellows in the shared image
 * that the real board never showed (word "robot" + guess "ooooo" shared as three yellows
 * the player never earned). Anything that needs to colour a guess calls this.
 */

/** @typedef {'correct'|'present'|'absent'} TileStatus */

/**
 * Scores a guess against the answer, honouring letter counts.
 *
 * Two passes are required, and in this order: exact matches claim their letter first,
 * then the remaining letters are matched positionally. A single pass would let an early
 * misplaced letter consume the occurrence that a later exact match is entitled to.
 *
 * @param {string} guess  five letters, any case
 * @param {string} word   the answer, any case
 * @returns {TileStatus[]} one status per letter of `guess`
 */
export function scoreGuess(guess, word) {
  const g = String(guess || '').toLowerCase()
  const w = String(word || '').toLowerCase()
  const statuses = Array(g.length).fill('absent')

  // Working copy of the answer's letters; each is nulled once something claims it, so a
  // letter is never credited to more tiles than the answer actually contains.
  const remaining = w.split('')

  for (let i = 0; i < g.length; i++) {
    if (g[i] === remaining[i]) {
      statuses[i] = 'correct'
      remaining[i] = null
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (statuses[i] === 'correct') continue
    const at = remaining.indexOf(g[i])
    if (at !== -1) {
      statuses[i] = 'present'
      remaining[at] = null
    }
  }

  return statuses
}

// Best-to-worst, for folding many tile statuses for the same letter into the one status
// its keyboard key should show.
const RANK = { correct: 3, present: 2, absent: 1 }

/**
 * Aggregates every guess into a per-letter keyboard status, keeping the best status each
 * letter has earned. Derived from scoreGuess so the keyboard can never disagree with the
 * board about whether a letter is in the word.
 *
 * @param {string[]} guesses
 * @param {string} word
 * @returns {Record<string, TileStatus>} uppercase letter -> status
 */
export function keyStatuses(guesses, word) {
  const out = {}
  for (const guess of guesses) {
    const statuses = scoreGuess(guess, word)
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toUpperCase()
      const next = statuses[i]
      if (!out[letter] || RANK[next] > RANK[out[letter]]) out[letter] = next
    }
  }
  return out
}
