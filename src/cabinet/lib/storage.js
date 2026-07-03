// Home-grid panel order, one dedicated key so it doesn't collide with the
// theme preference in lib/theme.js. Same read/write shape as Tempo's storage.

const PREFIX = 'cabinet:'

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

export function loadOrder() {
  return read('order', null)
}

export function saveOrder(order) {
  write('order', order)
}

// ── Last-opened timestamps (keyed by app.file) ──────────────────────────────
export function loadLastOpened() {
  return read('lastOpened', {})
}

export function recordOpened(file) {
  const map = loadLastOpened()
  map[file] = Date.now()
  write('lastOpened', map)
}

// ── Sort mode: 'manual' | 'recent' | 'az' ───────────────────────────────────
export function loadSort() {
  return read('sort', 'manual')
}

export function saveSort(sort) {
  write('sort', sort)
}

// ── Legacy (kind: 'static') apps visibility — off by default ───────────────
export function loadShowLegacy() {
  return read('showLegacy', false)
}

export function saveShowLegacy(showLegacy) {
  write('showLegacy', showLegacy)
}
