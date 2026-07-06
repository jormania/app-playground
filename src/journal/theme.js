// Theme presets (3 light + 3 dark) for Journal of Delights. Plain JS — this app is not typechecked.
//
// The chosen preset lives in the `jod_theme` localStorage key, shared by BOTH the app and the
// field guide (same origin): one choice drives both, and a `storage` event keeps open pages in
// sync. The header button CYCLES through PRESETS in order — the list strictly alternates
// dark↔light, so every press flips the mode and the sun/moon glyph stays truthful.
//
// Each preset is a full `[data-theme="<id>"]` palette in journal.css, expressed in THIS app's own
// Solarized-derived token vocabulary (--bg/--ink/--blue/…), NOT the Claude DS `--color-*` tokens.
// Keep the id list + bar colours here in step with the inline FOUC script in
// journal-of-delights-react.html and the guide (public/journal-of-delights-guide.html), which map
// a preset to its light/dark MODE only.

/** @typedef {'light' | 'dark'} Mode */
/** @typedef {'solarized-dark'|'solarized-light'|'octagon'|'quiet-light'|'spectrum'|'filter-sun'} PresetId */

export const THEME_KEY = 'jod_theme'

/**
 * Presets in CYCLE ORDER — Solarized (brand) first, then interleaved so each header press flips
 * dark↔light. `barColor` is the mobile browser-chrome colour (the palette's canvas).
 * @type {{ id: PresetId, name: string, mode: Mode, barColor: string }[]}
 */
export const PRESETS = [
  { id: 'solarized-dark',  name: 'Solarized · Dark',       mode: 'dark',  barColor: '#002b36' },
  { id: 'solarized-light', name: 'Solarized · Light',      mode: 'light', barColor: '#fdf6e3' },
  { id: 'octagon',         name: 'Monokai Pro · Octagon',  mode: 'dark',  barColor: '#1e1f2b' },
  { id: 'quiet-light',     name: 'Quiet Light',            mode: 'light', barColor: '#f5f5f5' },
  { id: 'spectrum',        name: 'Monokai Pro · Spectrum', mode: 'dark',  barColor: '#191919' },
  { id: 'filter-sun',      name: 'Monokai Pro · Sun',      mode: 'light', barColor: '#faf4f2' },
]

/** @type {PresetId} */
export const DEFAULT_PRESET = 'solarized-dark'

const BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))

/** Does the OS currently prefer dark? (false where matchMedia is unavailable.) */
export function systemPrefersDark() {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Migrate a raw stored value (incl. the legacy 'light' | 'dark' prefs) to a PresetId. */
function normalizePreset(raw) {
  if (raw && raw in BY_ID) return raw
  if (raw === 'light') return 'solarized-light'
  if (raw === 'dark') return 'solarized-dark'
  return DEFAULT_PRESET
}

/** Look up a preset by id, falling back to the default. */
export function presetById(id) {
  return BY_ID[id] ?? BY_ID[DEFAULT_PRESET]
}

/** The resolved light/dark mode of a preset id (drives the header glyph + the guide's mode). */
export function modeOf(id) {
  return presetById(id).mode
}

/** The next preset in the cycle (wraps). Each step flips light↔dark by construction of PRESETS. */
export function nextPreset(id) {
  const i = PRESETS.findIndex((p) => p.id === id)
  return PRESETS[(i + 1) % PRESETS.length].id
}

function storage(explicit) {
  if (explicit) return explicit
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* locked-down context */
  }
  return null
}

/** Read the stored preset, migrating legacy prefs and defaulting to Solarized dark. */
export function loadPreset(explicit) {
  try {
    return normalizePreset(storage(explicit)?.getItem(THEME_KEY))
  } catch {
    return DEFAULT_PRESET
  }
}

/** Persist the chosen preset. No-op if storage is unavailable. */
export function savePreset(id, explicit) {
  try {
    storage(explicit)?.setItem(THEME_KEY, id)
  } catch {
    /* quota / private mode */
  }
}

/** Apply a preset to the document: the `data-theme` attribute (drives the palette) and the
 *  mobile browser-chrome `theme-color`. Safe to call where there's no DOM. */
export function applyPreset(id) {
  if (typeof document === 'undefined') return
  const preset = presetById(id)
  document.documentElement.setAttribute('data-theme', preset.id)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', preset.barColor)
}
