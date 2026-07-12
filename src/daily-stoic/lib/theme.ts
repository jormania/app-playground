// Theme presets (4 light + 4 dark). The chosen preset lives in a single dedicated localStorage key
// shared by BOTH the app and the standalone field guide (same origin), so one choice drives both and
// a `storage` event keeps open pages in sync. The header button CYCLES through PRESETS in order (each
// press flips light↔dark); Settings picks one directly. Pure-ish helpers here; the React wiring is in
// themeContext.tsx. Keep this in step with the inline FOUC script in sol-odysseys-react.html and the
// guide (the guide maps a preset to its light/dark MODE and keeps its own Deep Indigo palette).

/** The resolved light/dark mode of a preset. */
export type Theme = 'light' | 'dark'

/** The stable id of each palette — matches a `[data-theme="<id>"]` block in styles/tokens.css. */
export type PresetId =
  | 'indigo-light'
  | 'indigo-dark'
  | 'quiet-light'
  | 'octagon'
  | 'filter-sun'
  | 'ristretto'
  | 'solarized-light'
  | 'spectrum'

export interface Preset {
  id: PresetId
  /** Human-readable name (header title, Settings picker). */
  name: string
  mode: Theme
  /** Browser-chrome colour (`theme-color` meta) — the palette's canvas. */
  themeColor: string
  /** Three representative swatch colours for the Settings picker: [canvas, accent, text]. */
  swatch: [string, string, string]
}

export const THEME_KEY = 'sol-odyssey:theme'

/** The presets in CYCLE ORDER — brand-first, then interleaved light/dark. This order IS the header
 *  cycle sequence (index+1 wraps to 0), and it strictly alternates light → dark → light → … */
export const PRESETS: Preset[] = [
  { id: 'indigo-light',    name: 'Deep Indigo · Light',    mode: 'light', themeColor: '#4B45C6', swatch: ['#F7F7FC', '#4B45C6', '#1F1B4D'] },
  { id: 'indigo-dark',     name: 'Deep Indigo · Dark',     mode: 'dark',  themeColor: '#121127', swatch: ['#121127', '#9A93F5', '#ECEBF8'] },
  { id: 'quiet-light',     name: 'Quiet Light',            mode: 'light', themeColor: '#F5F5F5', swatch: ['#F5F5F5', '#705697', '#333333'] },
  { id: 'octagon',         name: 'Monokai Pro · Octagon',  mode: 'dark',  themeColor: '#1E1F2B', swatch: ['#1E1F2B', '#C39AC9', '#EAF2F1'] },
  { id: 'filter-sun',      name: 'Monokai Pro · Sun',      mode: 'light', themeColor: '#FAF4F2', swatch: ['#FAF4F2', '#7058BE', '#29242A'] },
  { id: 'ristretto',       name: 'Monokai Pro · Ristretto',mode: 'dark',  themeColor: '#211C1C', swatch: ['#211C1C', '#A8A9EB', '#FFF1F3'] },
  { id: 'solarized-light', name: 'Solarized · Light',      mode: 'light', themeColor: '#FDF6E3', swatch: ['#FDF6E3', '#6C71C4', '#586E75'] },
  { id: 'spectrum',        name: 'Monokai Pro · Spectrum', mode: 'dark',  themeColor: '#191919', swatch: ['#191919', '#948AE3', '#F7F1FF'] },
]

export const DEFAULT_PRESET: PresetId = 'indigo-light'

const BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]))

/** Does the OS currently prefer dark? (false where matchMedia is unavailable.) */
export function systemPrefersDark(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Migrate a raw stored value (incl. the legacy 'light' | 'dark' | 'system' prefs) to a PresetId. */
function normalizePreset(raw: string | null | undefined): PresetId {
  if (raw && raw in BY_ID) return raw as PresetId
  if (raw === 'light') return 'indigo-light'
  if (raw === 'dark') return 'indigo-dark'
  if (raw === 'system') return systemPrefersDark() ? 'indigo-dark' : 'indigo-light'
  return DEFAULT_PRESET
}

/** Look up a preset by id, falling back to the default. */
export function presetById(id: string | null | undefined): Preset {
  return BY_ID[id ?? ''] ?? BY_ID[DEFAULT_PRESET]
}

/** The resolved light/dark mode of a preset id (for the header toggle glyph, and the guide's mode). */
export function modeOf(id: PresetId): Theme {
  return presetById(id).mode
}

/** The next preset in the cycle (wraps). Each step flips light↔dark by construction of PRESETS. */
export function nextPreset(id: PresetId): PresetId {
  const i = PRESETS.findIndex((p) => p.id === id)
  return PRESETS[(i + 1) % PRESETS.length]!.id
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(explicit?: StorageLike): StorageLike | null {
  if (explicit) return explicit
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* locked-down context */
  }
  return null
}

/** Read the stored preset, migrating legacy prefs and defaulting to Deep Indigo light. */
export function loadPreset(explicit?: StorageLike): PresetId {
  try {
    return normalizePreset(storage(explicit)?.getItem(THEME_KEY))
  } catch {
    return DEFAULT_PRESET
  }
}

/** Persist the chosen preset. No-op if storage is unavailable. */
export function savePreset(id: PresetId, explicit?: StorageLike): void {
  try {
    storage(explicit)?.setItem(THEME_KEY, id)
  } catch {
    /* quota / private mode */
  }
}

/** Apply a preset to the document: the `data-theme` attribute (drives the token palette) and the
 *  browser-chrome `theme-color`. Safe to call where there's no DOM. */
export function applyPreset(id: PresetId): void {
  if (typeof document === 'undefined') return
  const preset = presetById(id)
  document.documentElement.setAttribute('data-theme', preset.id)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', preset.themeColor)
}
