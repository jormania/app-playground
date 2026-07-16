import {
  loadSeason,
  saveSeason,
  loadLastShownDate,
  saveLastShownDate,
  loadLastAnsweredDate,
  saveLastAnsweredDate,
  loadStreak,
  saveStreak,
  loadBestStreak,
  saveBestStreak,
  loadHistory,
  saveHistory,
  loadSeasonsCompleted,
  saveSeasonsCompleted,
} from './storage'

// Local YYYY-MM-DD for a Date (NOT toISOString, which is UTC and shifts the
// day across midnight for anyone west of Greenwich).
export function getTodayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Add `n` days to a YYYY-MM-DD key, via the Date constructor's own calendar
// normalization — never diff two local-midnight Dates in milliseconds, since
// a DST transition day isn't 86,400,000ms.
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return getTodayKey(new Date(y, m - 1, d + n))
}

// Fisher-Yates, pure — returns a new array.
export function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function isValidSeason(season, lawCount) {
  return Boolean(
    season &&
      Array.isArray(season.order) &&
      season.order.length === lawCount &&
      Number.isInteger(season.position) &&
      season.position >= 0 &&
      season.position < lawCount
  )
}

function startNewSeason(lawIds) {
  return { order: shuffle(lawIds), position: 0 }
}

// Read-decide-persist-return: figures out which law id is "today's", advancing
// the season by exactly one step per new calendar day. Missed days are not
// backfilled — reopening after a gap still advances only one position, so the
// season just resumes where it left off.
export function getDailyLawId(laws, now = new Date()) {
  const lawIds = laws.map((law) => law.id)
  const today = getTodayKey(now)
  let season = loadSeason()
  const lastShownDate = loadLastShownDate()

  if (!isValidSeason(season, lawIds.length)) {
    season = startNewSeason(lawIds)
    saveSeason(season)
    saveLastShownDate(today)
    return season.order[season.position]
  }

  if (lastShownDate === today) {
    return season.order[season.position]
  }

  const nextPosition = season.position + 1
  if (nextPosition < season.order.length) {
    season = { order: season.order, position: nextPosition }
  } else {
    // The rotation just cycled through every law and is reshuffling — a real
    // completed season, tracked here (not derived from answer counts: a
    // season advances on days the app was merely opened, not just days
    // actually answered, so "totalAnswers / 48" can under-count).
    saveSeasonsCompleted(loadSeasonsCompleted() + 1)
    season = startNewSeason(lawIds)
  }
  saveSeason(season)
  saveLastShownDate(today)
  return season.order[season.position]
}

// { law, phase: 'quiz' | 'locked', streak, lastResult }
export function getDailyStatus(laws, now = new Date()) {
  const today = getTodayKey(now)
  const lawId = getDailyLawId(laws, now)
  const law = laws.find((l) => l.id === lawId)
  const lastAnsweredDate = loadLastAnsweredDate()
  // The stored streak only resets when the NEXT answer is recorded — so after
  // a multi-day gap it still holds the old run. Don't display that: a streak
  // is only alive if the last answer was today or yesterday.
  const streakAlive =
    lastAnsweredDate === today || (lastAnsweredDate && addDays(lastAnsweredDate, 1) === today)
  const streak = streakAlive ? loadStreak() : 0

  if (lastAnsweredDate === today) {
    const history = loadHistory()
    const entry = history[lawId]
    return {
      law,
      phase: 'locked',
      streak,
      lastResult: entry ? { correct: entry.lastAnsweredCorrect } : null,
    }
  }

  return { law, phase: 'quiz', streak, lastResult: null }
}

// Persists an answer: updates per-law history, the consecutive-day streak
// (consecutive-day-answered, not consecutive-correct — answering right or
// wrong still counts toward the streak), and the all-time best streak (a
// high-water mark that only ever grows). Returns the updated
// { streak, bestStreak, history }.
export function recordAnswer(lawId, correct, now = new Date()) {
  const today = getTodayKey(now)
  const lastAnsweredDate = loadLastAnsweredDate()

  const streak = lastAnsweredDate && addDays(lastAnsweredDate, 1) === today
    ? loadStreak() + 1
    : 1
  const bestStreak = Math.max(loadBestStreak(), streak)

  const history = loadHistory()
  const entry = history[lawId] || { correctCount: 0, incorrectCount: 0 }
  const updatedEntry = {
    correctCount: entry.correctCount + (correct ? 1 : 0),
    incorrectCount: entry.incorrectCount + (correct ? 0 : 1),
    lastAnsweredCorrect: correct,
    lastAnsweredDate: today,
  }
  const updatedHistory = { ...history, [lawId]: updatedEntry }

  saveStreak(streak)
  saveBestStreak(bestStreak)
  saveHistory(updatedHistory)
  saveLastAnsweredDate(today)

  return { streak, bestStreak, history: updatedHistory }
}
