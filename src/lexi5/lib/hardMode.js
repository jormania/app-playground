import { scoreGuess } from './score'

/**
 * Hard Mode: every hint the previous guess revealed must be reused.
 *
 * Lifted out of App.jsx, where it was ~55 lines of three-pass constraint checking inlined
 * in a useCallback — the most intricate rule in the app, and reachable only through full
 * component tests. It's a pure function of its inputs, so it belongs here where it can be
 * tested directly.
 *
 * @param {string} guess      the guess being submitted
 * @param {string} lastGuess  the previous guess, whose hints must be honoured
 * @param {string} word       the answer
 * @returns {string|null} a player-facing message, or null if the guess is allowed
 */
export function validateHardMode(guess, lastGuess, word) {
  const g = String(guess || '').toLowerCase()
  const last = String(lastGuess || '').toLowerCase()
  const target = String(word || '').toLowerCase()

  const lastStatuses = scoreGuess(last, target)

  // Greens must stay put, in the same position.
  for (let i = 0; i < lastStatuses.length; i++) {
    if (lastStatuses[i] === 'correct' && g[i] !== last[i]) {
      return `Must use ${last[i].toUpperCase()} in position ${i + 1}`
    }
  }

  // Yellows must reappear somewhere. Counting matters: two yellow E's oblige the next
  // guess to contain two E's, so this compares counts rather than mere presence.
  const requiredYellows = {}
  for (let i = 0; i < lastStatuses.length; i++) {
    if (lastStatuses[i] === 'present') {
      requiredYellows[last[i]] = (requiredYellows[last[i]] || 0) + 1
    }
  }

  // Only positions that aren't satisfying a green can pay off a yellow, otherwise a
  // letter locked in place would be double-counted as also covering its own yellow.
  const available = {}
  for (let i = 0; i < g.length; i++) {
    if (lastStatuses[i] === 'correct') continue
    available[g[i]] = (available[g[i]] || 0) + 1
  }

  for (const [char, count] of Object.entries(requiredYellows)) {
    if ((available[char] || 0) < count) {
      return `Guess must contain ${char.toUpperCase()}`
    }
  }

  return null
}
