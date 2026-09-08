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
// eight independent nature LAYERS you blend freely (level 0 = that layer is off),
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

// ── Curated blends ──────────────────────────────────────────────────────────
// Eleven hand-tuned mixes, shipped with the app and shown alongside your own
// saved ones. They ship in CODE rather than being seeded into `customMixes` for two
// reasons: those four slots are yours (MAX_CUSTOM_MIXES), and a seeded copy
// would either come back after you deleted it or never get the benefit of a
// later retune — these can be improved in any commit.
//
// Every one of them is built for one job, falling asleep, which is a stronger
// constraint than it sounds:
//   · NO layer that can startle sits high. Chime appears once, at 2 (a very
//     soft tone now and then); Rain only reaches 6 in the one storm blend, and
//     that one is deliberately dark — Rain's level is also Thunder's, and dark
//     is what makes a roll read as far away rather than overhead.
//   · WIND is never the lead. It thickens and animates a scene — it shares the
//     weather drift with Rain and Leaves, so it is what makes a gust read as one
//     event across the whole mix — but nothing here is a wind blend.
//   · Motion and Pace stay low. Both control how much and how fast the scene
//     moves, and stillness is the point.
//   · Warmth and Drone under nearly all of them: a pink-noise floor is the most
//     restful thing in the file and the best masker.
//   · Several are close to bare. A blend is not better for having more layers
//     in it, and several of these are essentially one idea each.
//
// They deliberately DO NOT set `volume`. Applying one merges over your current
// mix, so your own loudness survives — a preset that carried its own volume
// could jump the level the instant you tapped it, which is the exact thing a
// sleep app must never do.
export const CURATED_MIXES = [
  // ── rain ──────────────────────────────────────────────────────────────────
  // the archetype, and the clearest listen for the droplets
  { id: 'first-rain', name: 'first rain',
    mix: { rain: 5, waves: 0, stream: 0, wind: 2, leaves: 0, chime: 0, warmth: 5, drone: 2, brightness: 5, motion: 3, pace: 4 } },
  // close and almost still: rain low enough that the drops arrive about one a
  // second and you hear each one land, over a warm floor doing the masking
  { id: 'eaves-rain', name: 'eaves rain',
    mix: { rain: 3, waves: 0, stream: 0, wind: 1, leaves: 0, chime: 0, warmth: 6, drone: 3, brightness: 6, motion: 2, pace: 3 } },
  // rain in a wood: Rain, Wind and Leaves share one weather drift, so a gust
  // brightens the air, stirs the trees and leans the rain in together
  { id: 'cedar-rain', name: 'cedar rain',
    mix: { rain: 4, waves: 0, stream: 0, wind: 3, leaves: 4, chime: 0, warmth: 4, drone: 2, brightness: 5, motion: 4, pace: 4 } },
  // weather happening somewhere else. Brightness 3 is doing the work — it puts
  // the whole storm behind glass, which is what keeps the thunder comfortable
  { id: 'far-storm', name: 'far storm',
    mix: { rain: 6, waves: 0, stream: 0, wind: 3, leaves: 0, chime: 0, warmth: 5, drone: 4, brightness: 3, motion: 5, pace: 3 } },

  // ── waves ─────────────────────────────────────────────────────────────────
  // a big, slow, open sea — the deepest swell the Waves layer will give you
  { id: 'long-swell', name: 'long swell',
    mix: { rain: 0, waves: 6, stream: 0, wind: 1, leaves: 0, chime: 0, warmth: 5, drone: 3, brightness: 5, motion: 6, pace: 3 } },
  // the same sea drawn right down: small, slow, unhurried
  { id: 'low-tide', name: 'low tide',
    mix: { rain: 0, waves: 4, stream: 0, wind: 2, leaves: 0, chime: 0, warmth: 5, drone: 3, brightness: 4, motion: 3, pace: 2 } },
  // dark water. Brightness 2 takes the foam almost entirely out, leaving the
  // swell and a low hum under it — the deepest, least eventful blend here
  { id: 'night-sea', name: 'night sea',
    mix: { rain: 0, waves: 5, stream: 0, wind: 1, leaves: 0, chime: 0, warmth: 5, drone: 5, brightness: 2, motion: 3, pace: 2 } },

  // ── stream ────────────────────────────────────────────────────────────────
  // running water, close and bright — the resonant bubbles carry this one
  { id: 'mountain-brook', name: 'mountain brook',
    mix: { rain: 0, waves: 0, stream: 6, wind: 1, leaves: 2, chime: 0, warmth: 4, drone: 2, brightness: 6, motion: 3, pace: 4 } },
  // the same water heard from further off and under stone: dark, so the room
  // behind it does more of the work than the babble in front
  { id: 'stone-hollow', name: 'stone hollow',
    mix: { rain: 0, waves: 0, stream: 5, wind: 1, leaves: 1, chime: 0, warmth: 5, drone: 3, brightness: 3, motion: 2, pace: 3 } },
  // two waters at once. Stream is the one layer left out of the shared weather,
  // so it holds steady while the rain ebbs around it — a very effective mask
  { id: 'river-rain', name: 'river rain',
    mix: { rain: 4, waves: 0, stream: 4, wind: 1, leaves: 1, chime: 0, warmth: 4, drone: 2, brightness: 5, motion: 3, pace: 4 } },

  // ── leaves ────────────────────────────────────────────────────────────────
  // the only blend with a furin in it, and it sits at 2 on purpose: present
  // once in a while, never enough to wait for
  { id: 'night-garden', name: 'night garden',
    mix: { rain: 0, waves: 0, stream: 0, wind: 3, leaves: 4, chime: 2, warmth: 4, drone: 2, brightness: 5, motion: 4, pace: 3 } },
]

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
  stereo: true, // bed stereo width — a decorrelated L/R pair per layer instead of mono
  // What is playing it. 'speaker' moves the low-frequency layers up into a
  // small portable's passband (see VOICINGS in soundscape.js); 'headphones' is
  // the reference tuning. Defaults to headphones so an existing night sounds
  // exactly as it did — this is a deliberate choice you make once, not a
  // migration that changes the app under you.
  voicing: 'headphones',
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
