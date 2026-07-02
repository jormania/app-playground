const PREFIX = 'tempo:'

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

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

// ── Per-mode last-used configuration ────────────────────────────────────────
export function loadModeConfig(mode, fallback) {
  return read(`config:${mode}`, fallback)
}

export function saveModeConfig(mode, config) {
  write(`config:${mode}`, config)
}

// ── User preferences (sound / wake-lock / haptics) ──────────────────────────
export function loadPreferences(fallback) {
  return read('preferences', fallback)
}

export function savePreferences(prefs) {
  write('preferences', prefs)
}

// ── Home-screen panel order (array of mode ids) ─────────────────────────────
export function loadOrder(fallback) {
  const saved = read('order', null)
  return Array.isArray(saved) ? saved : fallback
}

export function saveOrder(order) {
  write('order', order)
}

// ── In-progress session snapshot — lets a practice survive the app closing ──
export function loadActiveSession() {
  return read('active', null)
}

export function saveActiveSession(session) {
  write('active', session)
}

export function clearActiveSession() {
  remove('active')
}
