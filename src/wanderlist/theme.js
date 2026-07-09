// Theme system — brought over from Journal of Delights as-is, so Wanderlist has the same
// six palettes and the same cycle-through button (per request: "as close to the original
// as possible"). Plain JS — this app is not typechecked.
//
// The chosen preset lives in the `wanderlist_theme` localStorage key. The header button
// CYCLES through PRESETS in order — the list strictly alternates dark↔light, so every
// press flips the mode and the sun/moon glyph (the mode you'll switch TO) stays truthful.
//
// Each preset is a full `[data-theme="<id>"]` palette in wanderlist.css, expressed in the
// same Solarized-derived token vocabulary as JoD (--bg/--ink/--blue/…). Keep the id list +
// bar colours here in step with the inline FOUC script in wanderlist-react.html and the
// guide (public/wanderlist-guide.html), which map a preset to its light/dark MODE only.

/** @typedef {'light' | 'dark'} Mode */
/** @typedef {'solarized-dark'|'solarized-light'|'octagon'|'quiet-light'|'spectrum'|'filter-sun'} PresetId */

export const THEME_KEY = 'wanderlist_theme'

/**
 * Presets in CYCLE ORDER — Solarized first, then interleaved so each header press flips
 * dark↔light. `barColor` is the mobile browser-chrome colour (the palette's canvas).
 * `swatch` is `[canvas, accent, ink]` — the only place raw hex is legitimate outside the
 * `[data-theme]` blocks in wanderlist.css, since it's a colour PREVIEW of the palette for
 * the Settings theme picker (the same swatch-of-itself exception Sol Odyssey makes).
 * @type {{ id: PresetId, name: string, mode: Mode, barColor: string, swatch: [string, string, string] }[]}
 */
export const PRESETS = [
  { id: 'solarized-dark',  name: 'Solarized · Dark',       mode: 'dark',  barColor: '#002b36', swatch: ['#002b36', '#268bd2', '#c0cccc'] },
  { id: 'solarized-light', name: 'Solarized · Light',      mode: 'light', barColor: '#fdf6e3', swatch: ['#fdf6e3', '#268bd2', '#3a4d52'] },
  { id: 'octagon',         name: 'Monokai Pro · Octagon',  mode: 'dark',  barColor: '#1e1f2b', swatch: ['#1e1f2b', '#78c7e0', '#eaf2f1'] },
  { id: 'quiet-light',     name: 'Quiet Light',            mode: 'light', barColor: '#f5f5f5', swatch: ['#f5f5f5', '#4b83cd', '#333333'] },
  { id: 'spectrum',        name: 'Monokai Pro · Spectrum', mode: 'dark',  barColor: '#191919', swatch: ['#191919', '#5ad4e6', '#f7f1ff'] },
  { id: 'filter-sun',      name: 'Monokai Pro · Sun',      mode: 'light', barColor: '#faf4f2', swatch: ['#faf4f2', '#7058be', '#29242a'] },
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

/** The next preset in the cycle (wraps). Each step flips light↔dark by construction. */
export function nextPreset(id) {
  const i = PRESETS.findIndex((p) => p.id === id)
  return PRESETS[(i + 1) % PRESETS.length].id
}

function storage(explicit) {
  if (explicit) return explicit
  try { if (typeof localStorage !== 'undefined') return localStorage } catch { /* locked down */ }
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
  try { storage(explicit)?.setItem(THEME_KEY, id) } catch { /* quota / private mode */ }
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
