// The Chorus mix model. Touch Grass's soundscape is a layer-blend engine ported
// from Yoru (see ambientAudio.js) — its eight nature LAYERS and four global
// SHAPERS, plus a few Touch Grass one-shot VOICES (birds, city sounds, rare
// omens) dialled by their own category levels and an Activity shaper. Every
// control is an integer 0..10.

export const MIX_MAX = 10

// Bump when the meaning of a stored number changes (a new taper, a renamed key),
// so a mix saved under the old scheme is discarded rather than misread. v2 is the
// Yoru-engine rewrite — it shares no keys' meaning with the old biome-bed mixer.
export const MIX_VERSION = 2

// The eight blendable beds (0 = that layer is off). Ported 1:1 from Yoru.
export const LAYER_KEYS = ['rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth', 'drone']

// The out-of-box blend: Yoru's Forest preset (a breezy wood) for the beds — the
// most "outdoors" of the five presets and the right first impression for Touch
// Grass — plus Yoru's shaper defaults and a moderate dab of birdsong. Volume and
// brightness sit at 8, not 5: both read through a perceptual taper in the engine
// that pulls mid values down, so 8 restores the loudness/tone a naive "5" implies.
export const DEFAULT_MIX = {
  // layers (Yoru Forest)
  rain: 1, waves: 0, stream: 0, wind: 4, leaves: 6, chime: 0, warmth: 4, drone: 2,
  // shapers (Yoru defaults)
  volume: 8, brightness: 8, motion: 5, pace: 5,
  // Touch Grass voices
  wildlife: 5, city: 2, omens: 3, activity: 5,
}

// The five soundscapes, ported verbatim from Yoru — each stamps only the eight
// LAYER_KEYS, leaving the shapers and the Touch Grass voices untouched (exactly
// as Yoru's own scene picks leave the shapers). Order here is the display order.
export const SCENE_PRESETS = {
  rain:   { rain: 6, waves: 0, stream: 0, wind: 3, leaves: 0, chime: 0, warmth: 5, drone: 3 },
  waves:  { rain: 0, waves: 6, stream: 0, wind: 1, leaves: 0, chime: 0, warmth: 5, drone: 3 },
  stream: { rain: 0, waves: 0, stream: 6, wind: 1, leaves: 1, chime: 0, warmth: 4, drone: 2 },
  wind:   { rain: 0, waves: 0, stream: 0, wind: 6, leaves: 2, chime: 0, warmth: 5, drone: 3 },
  forest: { rain: 1, waves: 0, stream: 0, wind: 4, leaves: 6, chime: 0, warmth: 4, drone: 2 },
}

export const PRESET_ORDER = ['rain', 'waves', 'stream', 'wind', 'forest']
export const PRESET_LABELS = { rain: 'Rain', waves: 'Waves', stream: 'Stream', wind: 'Wind', forest: 'Forest' }

// which preset (if any) the current mix's layers exactly match — for the
// active-chip highlight; null when the layers have been hand-tweaked away from
// every preset.
export function activePreset(mix) {
  if (!mix) return null
  return PRESET_ORDER.find((key) => LAYER_KEYS.every((k) => (mix[k] ?? 0) === SCENE_PRESETS[key][k])) || null
}
