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
  // layers (0 = off). Chime is an ACCENT layer by design — meant to sit over
  // another layer, not stand as a scene on its own — so it has no dedicated
  // quick-pick preset in Settings; it only shows up here, in the mixer.
  rain: 6,
  waves: 0,
  stream: 0,
  wind: 3,
  leaves: 0,
  chime: 0,
  warmth: 5,
  drone: 3,
  // shapers — volume and brightness sit above the visual midpoint (not 5) because
  // both now read through a perceptual taper (soundscape.js): the curve pulls
  // mid-range values down so a real "5" would sound quieter/darker than the app
  // used to feel by default. 7/8 roughly restores the old out-of-the-box level.
  volume: 8,
  brightness: 8,
  motion: 5, // depth of the swell
  pace: 5, // speed of the swell / drift
}

// The main-Settings "Sound" quick-pick stamps one of these starting blends onto
// the layers (shapers are left untouched); the mixer then refines it. Every
// preset lists every layer explicitly (including the zeroed ones) so switching
// scenes always fully resets the blend, not just the layers it cares about.
export const SCENE_PRESETS = {
  rain: { rain: 6, waves: 0, stream: 0, wind: 3, leaves: 0, chime: 0, warmth: 5, drone: 3 },
  waves: { rain: 0, waves: 6, stream: 0, wind: 1, leaves: 0, chime: 0, warmth: 5, drone: 3 },
  wind: { rain: 0, waves: 0, stream: 0, wind: 6, leaves: 2, chime: 0, warmth: 5, drone: 3 },
  forest: { rain: 1, waves: 0, stream: 0, wind: 4, leaves: 6, chime: 0, warmth: 4, drone: 2 },
  stream: { rain: 0, waves: 0, stream: 6, wind: 1, leaves: 1, chime: 0, warmth: 4, drone: 2 },
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
  moonPath: true,
  starReveal: true,
  palette: 'storm',
  name: '',
  hintSeen: false, // first-run "tap 夜" hint
  customMixes: [], // saved mixer blends: [{ id, name, mix }]
}

// Bump whenever the mix's underlying CURVE changes meaning (not just its
// default values) — e.g. introducing the perceptual taper in soundscape.js
// meant the same saved number (say, volume: 5) suddenly produced a different,
// usually quieter, actual gain than before. A stale saved mix that predates the
// current curve is reset to the fresh defaults rather than silently carried
// forward at the wrong loudness.
const MIX_VERSION = 2

export function loadSettings() {
  const s = read('settings', DEFAULT_SETTINGS)
  const staleMix = !s || s.mixVersion !== MIX_VERSION
  const result = {
    ...DEFAULT_SETTINGS,
    ...s,
    // Merge deeply enough that a newly-added mix control fills in from the
    // default; but if the curve itself has moved on, don't carry old numbers
    // forward at all.
    mix: staleMix ? { ...DEFAULT_MIX } : { ...DEFAULT_MIX, ...s.mix },
    mixVersion: MIX_VERSION,
  }
  // Persist the migration immediately rather than leaving the on-disk copy
  // stale until the user happens to change some other setting.
  if (staleMix) saveSettings(result)
  return result
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
