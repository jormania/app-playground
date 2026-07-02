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

export function loadModeConfig(mode, fallback) {
  return read(`config:${mode}`, fallback)
}

export function saveModeConfig(mode, config) {
  write(`config:${mode}`, config)
}

export function loadPreferences(fallback) {
  return read('preferences', fallback)
}

export function savePreferences(prefs) {
  write('preferences', prefs)
}
