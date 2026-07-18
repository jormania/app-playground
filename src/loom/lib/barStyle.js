// Which shape the bottom navigation takes. Purely presentational — every style
// carries the same view switch and Settings access — so it lives on its own
// device-local key (like the theme and the vocabulary), synced across tabs.

export const BARSTYLE_KEY = 'loom:barstyle'

export const BAR_STYLES = [
  { id: 'row', name: 'Slim row' },
  { id: 'pill', name: 'Floating pill' },
  { id: 'tabs', name: 'Icon tabs' },
]

export const DEFAULT_BARSTYLE = 'row'

export function loadBarStyle() {
  try {
    const v = localStorage.getItem(BARSTYLE_KEY)
    if (BAR_STYLES.some(s => s.id === v)) return v
  } catch { /* private mode */ }
  return DEFAULT_BARSTYLE
}

export function saveBarStyle(id) {
  try { localStorage.setItem(BARSTYLE_KEY, id) } catch { /* quota */ }
}
