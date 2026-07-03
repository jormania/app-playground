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

// ── Open stats (keyed by app.file): { count, last } ─────────────────────────
// Counts taps on the Cabinet's own tiles, not real app launches — opening an
// installed PWA from its home-screen icon bypasses the Cabinet entirely and
// isn't seen here.
export function loadLastOpened() {
  return read('lastOpened', {})
}

export function recordOpened(file) {
  const map = loadLastOpened()
  const prevCount = typeof map[file] === 'object' && map[file] ? map[file].count : 0
  map[file] = { count: prevCount + 1, last: Date.now() }
  write('lastOpened', map)
}

// ── Sort mode: 'manual' | 'recent' | 'az' ───────────────────────────────────
export function loadSort() {
  return read('sort', 'manual')
}

export function saveSort(sort) {
  write('sort', sort)
}
