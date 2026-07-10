// The Chorus mix model. Touch Grass's soundscape is a layer-blend engine ported
// from Yoru (see ambientAudio.js) — its seven nature LAYERS and three global
// SHAPERS, plus two Touch Grass one-shot VOICE groups (wildlife, rare omens)
// dialled by their own levels and an Activity shaper. Every control is an
// integer 0..10.

export const MIX_MAX = 10

// Bump when the meaning of a stored number changes (a new taper, a renamed key),
// so a mix saved under the old scheme is discarded rather than misread. v2 is the
// Yoru-engine rewrite — it shares no keys' meaning with the old biome-bed mixer.
// (Dropping the drone layer and city voices later didn't need a bump: the
// remaining keys keep their meaning, and any stale drone/city value in an old
// save is simply ignored by the engine and the mixer.)
export const MIX_VERSION = 2

// The seven blendable beds (0 = that layer is off). Ported from Yoru, minus its
// `drone` — a tonal hum that earns its place under Yoru's sleep masking but reads
// as synthetic outdoors.
export const LAYER_KEYS = ['rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth']

// The five soundscapes are complete curated scenes: each dials all the CHARACTER
// controls — the seven layers, the two voices, Activity, and the brightness /
// motion / pace shapers. They deliberately DON'T set the master `volume`: that's
// a personal comfort dial (like Yoru leaves the shapers out of its scene picks),
// so browsing presets never jumps your loudness. `activePreset` compares exactly
// this key set for the chip highlight.
export const PRESET_APPLY_KEYS = [
  'rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth',
  'wildlife', 'omens', 'activity', 'brightness', 'motion', 'pace',
]

// A studied full scene per preset (see the reasoning in each). Order here is the
// display order. Distinct enough that switching between them is a real change of
// place, layered enough that none sounds flat or synthetic.
export const SCENE_PRESETS = {
  // steady, cozy rain — wind gives it body, a little wet-leaf patter, a warm
  // floor beneath; tone pulled dark and muffled, voices sparse (rain masks the
  // world). Distant thunder rides the rain layer automatically.
  rain:   { rain: 7, waves: 0, stream: 0, wind: 4, leaves: 2, chime: 0, warmth: 5, wildlife: 2, omens: 2, activity: 3, brightness: 5, motion: 5, pace: 4 },
  // slow ocean surf — a sea breeze on the wind, long swells (motion up, pace
  // slow); almost no other life so the surf breathes.
  waves:  { rain: 0, waves: 7, stream: 0, wind: 3, leaves: 0, chime: 0, warmth: 4, wildlife: 1, omens: 2, activity: 3, brightness: 6, motion: 6, pace: 4 },
  // a woodland brook — babbling and bright and steady (low motion, no big swell),
  // with light wind through leaves and a lively scatter of birdsong over it.
  stream: { rain: 0, waves: 0, stream: 7, wind: 2, leaves: 3, chime: 0, warmth: 3, wildlife: 4, omens: 2, activity: 5, brightness: 8, motion: 4, pace: 5 },
  // open and windswept — the wind chime sings here, sparse exposed voices and the
  // odd wolf or bell carried on the air.
  wind:   { rain: 0, waves: 0, stream: 0, wind: 7, leaves: 2, chime: 2, warmth: 4, wildlife: 2, omens: 3, activity: 3, brightness: 6, motion: 6, pace: 6 },
  // a living wood — a full leaf canopy over a hidden brook and a little wind,
  // rich birdsong, and woodland omens (a woodpecker, a spring cuckoo). Airy tone.
  forest: { rain: 0, waves: 0, stream: 2, wind: 4, leaves: 6, chime: 0, warmth: 4, wildlife: 5, omens: 4, activity: 5, brightness: 8, motion: 5, pace: 5 },
}

export const PRESET_ORDER = ['rain', 'waves', 'stream', 'wind', 'forest']
export const PRESET_LABELS = { rain: 'Rain', waves: 'Waves', stream: 'Stream', wind: 'Wind', forest: 'Forest' }

// The out-of-box blend is the Forest scene at a comfortable volume — the most
// "outdoors" first impression, and one of the five curated presets, so the
// Forest chip reads as active on a fresh start.
export const DEFAULT_MIX = { ...SCENE_PRESETS.forest, volume: 8 }

// which preset (if any) the current mix's character exactly matches — for the
// active-chip highlight; null once anything has been hand-tweaked away from it
// (the master volume is ignored, since presets don't set it).
export function activePreset(mix) {
  if (!mix) return null
  return PRESET_ORDER.find((key) => PRESET_APPLY_KEYS.every((k) => (mix[k] ?? 0) === SCENE_PRESETS[key][k])) || null
}
