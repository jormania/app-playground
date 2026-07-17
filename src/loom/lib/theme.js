// Loom's own two palettes — SCUMM-flavoured, one dark, one light. Deliberately
// NOT the six-palette Journal/Wanderlist system: Loom has exactly two moods for
// now. Both are set purely through `[data-theme]` token overrides in loom.css,
// so every DS component adopts them with no special-casing.
//
// One localStorage key shared by the app and the standalone guide (same origin),
// so a single choice drives both and a `storage` event keeps open pages in sync.
// Keep in step with the inline FOUC script in loom-react.html and loom-guide.html.

export const THEME_KEY = 'loom:theme'

// The two presets. `mode` is what actually lands on <html data-theme>; `swatch`
// is [canvas, accent, ink] for the Appearance picker (the one place raw hex is
// legitimate outside the theme blocks — a preview OF each palette). `themeColor`
// tints the browser chrome (matches each palette's --color-bg).
export const PRESETS = [
  { id: 'twilight', mode: 'dark',  name: 'Twilight', themeColor: '#0b1f1f', swatch: ['#0b1f1f', '#c9a44c', '#efe6cc'] },
  { id: 'parchment', mode: 'light', name: 'Parchment', themeColor: '#e7d9b6', swatch: ['#e7d9b6', '#8f6316', '#2a2116'] },
]

const DEFAULT_ID = 'twilight' // Loom is a dusk game — dark is home base.

export function presetById(id) {
  return PRESETS.find(p => p.id === id) || PRESETS.find(p => p.id === DEFAULT_ID)
}

export function loadThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v && PRESETS.some(p => p.id === v)) return v
  } catch { /* private mode */ }
  return DEFAULT_ID
}

export function saveThemePref(id) {
  try { localStorage.setItem(THEME_KEY, id) } catch { /* quota */ }
}

// Cycle to the next preset (drives the header ◐ quick-toggle).
export function nextTheme(id) {
  const i = PRESETS.findIndex(p => p.id === id)
  return PRESETS[(i + 1) % PRESETS.length].id
}

export function applyTheme(id) {
  if (typeof document === 'undefined') return
  const p = presetById(id)
  document.documentElement.setAttribute('data-theme', p.mode)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', p.themeColor)
}
