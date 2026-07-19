// Drafts — Loom's "recurring weaves". A draft is a named, saved set of threads
// (each pinned to a day-of-week, or the distaff) that you can weave onto any week
// in one tap. Kept on THIS device in localStorage regardless of demo/live: a
// draft is a personal template, not board data, so it needs no Notion schema —
// casting it just creates ordinary threads in whatever store is active.
//
// A draft flagged `repeat: true` is one you mean to re-weave every week; the week
// view offers to cast it when you land on a fresh week (opt-in, never automatic).
// A cast log remembers which drafts were already cast or dismissed per week so the
// offer never nags.

const DRAFTS_KEY = 'loom_drafts'
const CAST_LOG_KEY = 'loom_cast_log'

let seq = 0
const newId = () => `draft-${Date.now().toString(36)}-${(seq++).toString(36)}`

export function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    }
  } catch { /* ignore */ }
  return []
}

function persist(drafts) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)) } catch { /* quota */ }
  return drafts
}

export function addDraft({ name, items, repeat = false }) {
  const drafts = loadDrafts()
  const draft = { id: newId(), name: (name || 'Untitled').trim() || 'Untitled', items: items || [], repeat: Boolean(repeat) }
  persist([...drafts, draft])
  return draft
}

export function updateDraft(id, patch) {
  const drafts = loadDrafts().map(d => (d.id === id ? { ...d, ...patch } : d))
  persist(drafts)
  return drafts.find(d => d.id === id) || null
}

export function removeDraft(id) {
  persist(loadDrafts().filter(d => d.id !== id))
}

// ── Cast log: { [weekStartKey]: [draftId, …] } — cast OR dismissed for that week ─
function loadCastLog() {
  try {
    const raw = localStorage.getItem(CAST_LOG_KEY)
    if (raw) return JSON.parse(raw) || {}
  } catch { /* ignore */ }
  return {}
}

export function isSettledForWeek(draftId, weekStartKey) {
  const log = loadCastLog()
  return Array.isArray(log[weekStartKey]) && log[weekStartKey].includes(draftId)
}

export function settleForWeek(draftId, weekStartKey) {
  const log = loadCastLog()
  const list = new Set(log[weekStartKey] || [])
  list.add(draftId)
  log[weekStartKey] = [...list]
  try { localStorage.setItem(CAST_LOG_KEY, JSON.stringify(log)) } catch { /* quota */ }
}

// Repeating drafts not yet cast or dismissed for the given week — what the week
// view may gently offer to re-weave.
export function pendingRepeats(weekStartKey) {
  return loadDrafts().filter(d => d.repeat && !isSettledForWeek(d.id, weekStartKey))
}

// Clear the draft cast log so repeating-draft offers re-appear for the current week.
export function resetDraftBanners() {
  try { localStorage.removeItem(CAST_LOG_KEY) } catch { /* ignore */ }
}
