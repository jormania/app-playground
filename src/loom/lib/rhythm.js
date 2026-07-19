// Rhythm — Loom's "daily routine". A rhythm is a skein (project) whose threads
// are placed onto selected days of a fresh week in one tap — the "givens" before
// the live work. Instead of splitting threads into "tasks vs. habits", one skein
// is flagged as the rhythm — a single localStorage key, zero Notion schema changes.
//
// The rhythm flag now carries an optional `days` mask: an array of weekday indices
// (0 = Monday … 6 = Sunday) that restricts which days receive the rhythm. A null
// `days` means all seven days (original behaviour). This is purely client-local.
//
// A cast log remembers which weeks have already been cast/dismissed, same pattern
// as drafts. Device-local, like drafts, theme and vocabulary.

const RHYTHM_KEY = 'loom_rhythm_skein'
const CAST_LOG_KEY = 'loom_rhythm_cast_log'

// ── The rhythm flag: { skeinName, days } ─────────────────────────────────────
// Stored as JSON so we can carry the days mask. Backward-compatible: if the old
// value was a plain string it is treated as { skeinName: value, days: null }.

export function loadRhythm() {
  try {
    const raw = localStorage.getItem(RHYTHM_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      // New format: { skeinName, days }
      if (parsed && typeof parsed === 'object' && parsed.skeinName) return parsed
      // Old format was a plain string — migrate on read
      if (typeof parsed === 'string') return { skeinName: parsed, days: null }
    } catch {
      // Legacy: the stored value was never JSON-encoded (just a raw string)
      if (typeof raw === 'string') return { skeinName: raw, days: null }
    }
  } catch { /* ignore */ }
  return null
}

// Save a rhythm object { skeinName, days } or null to clear.
// `days` is an array like [0,1,2,3,4] (Mon–Fri) or null (every day).
export function saveRhythm({ skeinName, days = null } = {}) {
  try {
    if (skeinName) localStorage.setItem(RHYTHM_KEY, JSON.stringify({ skeinName, days }))
    else localStorage.removeItem(RHYTHM_KEY)
  } catch { /* quota */ }
}

export function clearRhythm() {
  try { localStorage.removeItem(RHYTHM_KEY) } catch { /* ignore */ }
}

// ── Convenience accessors ─────────────────────────────────────────────────────

// The skein name currently flagged, or null.
export function loadRhythmSkein() {
  return loadRhythm()?.skeinName ?? null
}

// The days mask currently set, or null (= all days).
export function loadRhythmDays() {
  return loadRhythm()?.days ?? null
}

// ── Cast log: has the rhythm been cast or dismissed for a given week? ─────────

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

// The rhythm object { skeinName, days } if it exists and hasn't been settled for
// the given week; null otherwise.
export function pendingRhythm(weekStartKey) {
  const rhythm = loadRhythm()
  if (!rhythm) return null
  if (isRhythmSettledForWeek(weekStartKey)) return null
  return rhythm
}
