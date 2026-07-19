// Rhythm — Loom's "daily routine". A rhythm is a skein (project) whose threads
// are placed onto EVERY day of a fresh week in one tap — the "givens" before the
// live work. Instead of splitting threads into "tasks vs. habits", one skein is
// flagged as the rhythm — a single localStorage key, zero Notion schema changes.
//
// A cast log remembers which weeks have already been cast/dismissed, same pattern
// as drafts. Device-local, like drafts, theme and vocabulary.

const RHYTHM_KEY = 'loom_rhythm_skein'
const CAST_LOG_KEY = 'loom_rhythm_cast_log'

// ── The rhythm flag: which skein name is the rhythm ─────────────────────────

export function loadRhythm() {
  try {
    const v = localStorage.getItem(RHYTHM_KEY)
    return v || null
  } catch { return null }
}

export function saveRhythm(skeinName) {
  try {
    if (skeinName) localStorage.setItem(RHYTHM_KEY, skeinName)
    else localStorage.removeItem(RHYTHM_KEY)
  } catch { /* quota */ }
}

export function clearRhythm() {
  try { localStorage.removeItem(RHYTHM_KEY) } catch { /* ignore */ }
}

// ── Cast log: has the rhythm been cast or dismissed for a given week? ────────

function loadCastLog() {
  try {
    const raw = localStorage.getItem(CAST_LOG_KEY)
    if (raw) return JSON.parse(raw) || {}
  } catch { /* ignore */ }
  return {}
}

export function isRhythmSettledForWeek(weekStartKey) {
  const log = loadCastLog()
  return Boolean(log[weekStartKey])
}

export function settleRhythmForWeek(weekStartKey) {
  const log = loadCastLog()
  log[weekStartKey] = true
  try { localStorage.setItem(CAST_LOG_KEY, JSON.stringify(log)) } catch { /* quota */ }
}

// The rhythm skein name if it exists and hasn't been settled for the given week.
export function pendingRhythm(weekStartKey) {
  const skein = loadRhythm()
  if (!skein) return null
  if (isRhythmSettledForWeek(weekStartKey)) return null
  return skein
}
