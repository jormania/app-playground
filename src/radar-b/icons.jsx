// Hand-rolled line icons at a consistent 1.6 stroke — the app pulls in no icon
// library for six glyphs.
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const FilterIcon = (p) => (
  <svg {...base} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
)
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const SettingsIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
)
export const ExternalIcon = (p) => (
  <svg {...base} width="14" height="14" {...p}><path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
)
export const BackIcon = (p) => (
  <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
)
export const DismissIcon = (p) => (
  <svg {...base} {...p}><path d="M4 12h16" /></svg>
)
/** The wordmark's radar sweep, used as the empty-state mark too. */
export const RadarIcon = (p) => (
  <svg {...base} width="28" height="28" {...p}><circle cx="12" cy="12" r="9" opacity="0.35" /><circle cx="12" cy="12" r="5" opacity="0.6" /><path d="M12 12 18.5 7" /><circle cx="16.5" cy="9" r="1.4" fill="currentColor" stroke="none" /></svg>
)
