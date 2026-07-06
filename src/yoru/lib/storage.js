import { nightKey } from './night'

const PREFIX = 'yoru:'

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
    // private browsing / quota — persistence is a nice-to-have, skip silently
  }
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

// ── Settings (length + breath pattern), remembered across nights ────────────
export const DEFAULT_SETTINGS = {
  minutes: 15,
  breathwork: true,
  breath: 'exhale',
  scene: 'rain',
  intensity: 'gentle',
  volume: 'medium',
  screen: 'lit',
  palette: 'storm',
  name: '',
}

export function loadSettings() {
  const s = read('settings', DEFAULT_SETTINGS)
  return { ...DEFAULT_SETTINGS, ...s }
}

export function saveSettings(settings) {
  write('settings', settings)
}

// ── In-progress session — resumes within the SAME night, discarded after ────
// Shape: { startedAt, totalSec, breath, note, nightKey }
export function loadActiveSession() {
  const s = read('active', null)
  if (!s || typeof s !== 'object') return null
  // A session (and its note) belong to one night only. A new night wipes it.
  if (s.nightKey !== nightKey()) {
    remove('active')
    return null
  }
  return s
}

export function saveActiveSession(session) {
  write('active', { ...session, nightKey: nightKey() })
}

export function clearActiveSession() {
  remove('active')
}
