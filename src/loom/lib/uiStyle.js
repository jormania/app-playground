// The interface style — one choice that drives BOTH the top toolbar and the
// bottom navigation so they always come as a coordinated pair. Purely
// presentational (every style carries the same controls), so it lives on its own
// device-local key, synced across tabs.
//
//   row  — slim frosted, edge-to-edge, hairline borders
//   pill — floating, detached, rounded, blurred + shadowed
//   tabs — flat translucent, glyph + label

export const UISTYLE_KEY = 'loom:uistyle'
const LEGACY_KEY = 'loom:barstyle' // pre-coordination key (bottom bar only)

export const UI_STYLES = [
  { id: 'row', name: 'Slim row' },
  { id: 'pill', name: 'Floating pill' },
  { id: 'tabs', name: 'Icon tabs' },
]

export const DEFAULT_UISTYLE = 'row'

export function loadUiStyle() {
  try {
    const v = localStorage.getItem(UISTYLE_KEY)
    if (UI_STYLES.some(s => s.id === v)) return v
    // Carry over a choice made before top+bottom were coordinated.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (UI_STYLES.some(s => s.id === legacy)) return legacy
  } catch { /* private mode */ }
  return DEFAULT_UISTYLE
}

export function saveUiStyle(id) {
  try { localStorage.setItem(UISTYLE_KEY, id) } catch { /* quota */ }
}
