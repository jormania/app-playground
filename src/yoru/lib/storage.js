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

// ── The audio mixer — a layer-blend design (as A Soft Murmur / Noisli / myNoise):
// six independent nature LAYERS you blend freely (level 0 = that layer is off),
// plus four global SHAPERS. Every control is an integer level 0..10. The engine
// maps each to a real synth parameter (see soundscape.js). Reset returns to the
// default blend. Shaper defaults are the mid (5); layers make a gentle rain.
export const MIX_MAX = 10

export const DEFAULT_MIX = {
  // layers (0 = off)
  rain: 6,
  waves: 0,
  wind: 3,
  leaves: 0,
  warmth: 5,
  drone: 3,
  // shapers
  volume: 5,
  brightness: 5,
  motion: 5, // depth of the swell
  pace: 5, // speed of the swell / drift
}

// The main-Settings "Sound" quick-pick stamps one of these starting blends onto
// the layers (shapers are left untouched); the mixer then refines it.
export const SCENE_PRESETS = {
  rain: { rain: 6, waves: 0, wind: 3, leaves: 0, warmth: 5, drone: 3 },
  waves: { rain: 0, waves: 6, wind: 1, leaves: 0, warmth: 5, drone: 3 },
  wind: { rain: 0, waves: 0, wind: 6, leaves: 2, warmth: 5, drone: 3 },
  forest: { rain: 1, waves: 0, wind: 4, leaves: 6, warmth: 4, drone: 2 },
}

// ── Settings, remembered across nights ──────────────────────────────────────
export const DEFAULT_SETTINGS = {
  minutes: 15,
  breathwork: true,
  breath: 'exhale',
  haptics: false,
  scene: 'rain',
  mix: { ...DEFAULT_MIX },
  screen: 'lit',
  palette: 'storm',
  name: '',
  hintSeen: false, // first-run "tap 夜" hint
}

export function loadSettings() {
  const s = read('settings', DEFAULT_SETTINGS)
  // Merge deeply enough that a newly-added mix control fills in from the default.
  return { ...DEFAULT_SETTINGS, ...s, mix: { ...DEFAULT_MIX, ...(s && s.mix) } }
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
