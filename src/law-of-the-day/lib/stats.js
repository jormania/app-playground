// Aggregates the per-law answer history into display-ready stats. Pure —
// takes the static laws array and the history object loaded from storage.js,
// returns everything the stats screen needs to render.
export function computeStats(laws, history) {
  const perLaw = laws
    .filter((law) => history[law.id])
    .map((law) => {
      const entry = history[law.id]
      return {
        lawId: law.id,
        lawNumber: law.lawNumber,
        lawTitle: law.lawTitle,
        correctCount: entry.correctCount,
        incorrectCount: entry.incorrectCount,
        lastAnsweredCorrect: entry.lastAnsweredCorrect,
      }
    })
    .sort((a, b) => a.lawId - b.lawId)

  const correctCount = perLaw.reduce((sum, l) => sum + l.correctCount, 0)
  const incorrectCount = perLaw.reduce((sum, l) => sum + l.incorrectCount, 0)
  const totalAnswers = correctCount + incorrectCount
  const accuracyPercent = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0
  // A "season" is one full shuffled cycle through every law (see rotation.js) —
  // completed seasons is just how many full 48-answer cycles have passed.
  const seasonsCompleted = Math.floor(totalAnswers / laws.length)

  return {
    lawsSeen: perLaw.length,
    totalLaws: laws.length,
    totalAnswers,
    seasonsCompleted,
    correctCount,
    incorrectCount,
    accuracyPercent,
    perLaw,
  }
}
