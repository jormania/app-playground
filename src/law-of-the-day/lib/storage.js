const PREFIX = 'lawofday:'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // private browsing / quota exceeded — persistence is a nice-to-have, skip silently
  }
}

// ── Season rotation (shuffled law-id order + current position) ─────────────
export function loadSeason() {
  return read('season', null)
}

export function saveSeason(season) {
  write('season', season)
}

// ── Last calendar date the day's law was shown ──────────────────────────────
export function loadLastShownDate() {
  return read('lastShownDate', null)
}

export function saveLastShownDate(dateKey) {
  write('lastShownDate', dateKey)
}

// ── Last calendar date the user answered ────────────────────────────────────
export function loadLastAnsweredDate() {
  return read('lastAnsweredDate', null)
}

export function saveLastAnsweredDate(dateKey) {
  write('lastAnsweredDate', dateKey)
}

// ── Consecutive-day-answered streak ─────────────────────────────────────────
export function loadStreak() {
  return read('streak', 0)
}

export function saveStreak(streak) {
  write('streak', streak)
}

// ── All-time best streak (a high-water mark, never decreases) ──────────────
export function loadBestStreak() {
  return read('bestStreak', 0)
}

export function saveBestStreak(bestStreak) {
  write('bestStreak', bestStreak)
}

// ── Per-law answer history, for a future stats view ─────────────────────────
export function loadHistory() {
  return read('history', {})
}

export function saveHistory(history) {
  write('history', history)
}

// ── Difficulty tier preference (see lib/difficulty.js) ──────────────────────
export function loadDifficulty() {
  return read('difficulty', 'standard')
}

export function saveDifficulty(difficulty) {
  write('difficulty', difficulty)
}

// ── Completed seasons (a season = one full shuffled rotation reshuffling —
// see rotation.js's getDailyLawId) — incremented there, not derived from
// answer counts, since a season advances on days the app was merely OPENED,
// not just days actually answered. ─────────────────────────────────────────
export function loadSeasonsCompleted() {
  return read('seasonsCompleted', 0)
}

export function saveSeasonsCompleted(count) {
  write('seasonsCompleted', count)
}
