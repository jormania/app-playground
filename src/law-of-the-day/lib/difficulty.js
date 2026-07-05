// The three difficulty tiers, ordered easiest → hardest. Difficulty here is
// purely a function of *which distractors* the quiz shows — never more options,
// never a timer. See quiz.js for how each tier sources its wrong answers:
//   standard — the law's fixed curated decoy pool (the original behavior)
//   complex  — curated ∪ same-family laws, sampled for variety
//   extreme  — same pool, ranked hardest-first by a confusability score that
//              folds in your personal miss-history
export const DIFFICULTIES = ['standard', 'complex', 'extreme']

export const DIFFICULTY_LABELS = {
  standard: 'Standard',
  complex: 'Complex',
  extreme: 'Extreme',
}

// A guessed/legacy value falls back to the gentlest tier.
export function normalizeDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : 'standard'
}

// Cycles standard → complex → extreme → standard (for the header toggle).
export function nextDifficulty(value) {
  const i = DIFFICULTIES.indexOf(value)
  return DIFFICULTIES[(i + 1) % DIFFICULTIES.length]
}

// 1-based rank, used to fill the difficulty meter icon (1, 2, or 3 bars).
export function difficultyLevel(value) {
  const i = DIFFICULTIES.indexOf(value)
  return i < 0 ? 1 : i + 1
}

export function difficultyLabel(value) {
  return DIFFICULTY_LABELS[normalizeDifficulty(value)]
}
