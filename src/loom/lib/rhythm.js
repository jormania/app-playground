// Rhythm — Loom's "daily routine". Any number of skeins can be flagged as rhythms.
// Each rhythm entry is { skeinName, days } where `days` is an optional weekday-index
// mask (0 = Mon … 6 = Sun, null = every day). Zero Notion schema changes.
//
// Storage: loom_rhythm_skeins = JSON array of { skeinName, days }.
// Backward-compat: the old single-entry key loom_rhythm_skein is migrated on first read.
//
// Cast log: one settlement key per week covers all rhythms together (one banner, one
// dismiss — consistent with the repeating-drafts pattern).

const RHYTHMS_KEY   = 'loom_rhythm_skeins'   // the new array key
const LEGACY_KEY    = 'loom_rhythm_skein'     // single-entry compat
const CAST_LOG_KEY  = 'loom_rhythm_cast_log'

// ── Migrate legacy single-entry format on first access ───────────────────────
function migrate() {
  try {
    if (localStorage.getItem(RHYTHMS_KEY) !== null) return  // already migrated
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    let skeinName = null
    try {
      const parsed = JSON.parse(raw)
      skeinName = (parsed && typeof parsed === 'object') ? parsed.skeinName : String(parsed)
    } catch { skeinName = raw }
    if (skeinName) {
      localStorage.setItem(RHYTHMS_KEY, JSON.stringify([{ skeinName, days: null }]))
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}

// ── Core CRUD ────────────────────────────────────────────────────────────────

export function loadRhythms() {
  try {
    migrate()
    const raw = localStorage.getItem(RHYTHMS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { /* ignore */ }
  return []
}

function saveRhythms(list) {
  try { localStorage.setItem(RHYTHMS_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

// Add or update a rhythm entry for a skein. Days = null means every day.
export function addRhythm(skeinName, days = null) {
  const list = loadRhythms()
  const idx = list.findIndex(r => r.skeinName === skeinName)
  if (idx >= 0) list[idx] = { skeinName, days }
  else list.push({ skeinName, days })
  saveRhythms(list)
}

// Remove a skein from the rhythm list.
export function removeRhythm(skeinName) {
  saveRhythms(loadRhythms().filter(r => r.skeinName !== skeinName))
}

// Update only the days mask for an existing rhythm entry.
export function setRhythmDays(skeinName, days) {
  const list = loadRhythms()
  const entry = list.find(r => r.skeinName === skeinName)
  if (entry) { entry.days = days; saveRhythms(list) }
}

// Whether a given skein is currently flagged as a rhythm.
export function isRhythm(skeinName) {
  return loadRhythms().some(r => r.skeinName === skeinName)
}

// The rhythm entry for a specific skein, or null.
export function getRhythmEntry(skeinName) {
  return loadRhythms().find(r => r.skeinName === skeinName) ?? null
}

// All rhythm skein names (for quick Set lookups).
export function rhythmSkeinNames() {
  return loadRhythms().map(r => r.skeinName)
}

// Clear all rhythms.
export function clearAllRhythms() {
  try { localStorage.removeItem(RHYTHMS_KEY) } catch { /* ignore */ }
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
  return Boolean(loadCastLog()[weekStartKey])
}

export function settleRhythmForWeek(weekStartKey) {
  const log = loadCastLog()
  log[weekStartKey] = true
  try { localStorage.setItem(CAST_LOG_KEY, JSON.stringify(log)) } catch { /* quota */ }
}

// Clear the entire cast log so the rhythm offer re-appears for the current week.
export function resetRhythmBanners() {
  try { localStorage.removeItem(CAST_LOG_KEY) } catch { /* ignore */ }
}

// Returns the unsettled rhythms for the given week (array), or [] if all settled.
export function pendingRhythms(weekStartKey) {
  if (isRhythmSettledForWeek(weekStartKey)) return []
  return loadRhythms()
}
