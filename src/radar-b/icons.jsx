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
// A gear rendered with thin 8-way spokes (the earlier version) reads as a sun
// at 20px — exactly the confusion a settings glyph must avoid, since a sun is
// already the theme icon's own vocabulary. "Sliders" is the standard alternative
// wherever a gear stops being legible at icon size, and it reads unambiguously
// as "more than one adjustable setting" rather than "toggle a mode".
export const SettingsIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M21 18h-1" />
    <circle cx="15" cy="6" r="2.2" fill="var(--color-bg, #fff)" />
    <circle cx="6.5" cy="12" r="2.2" fill="var(--color-bg, #fff)" />
    <circle cx="18" cy="18" r="2.2" fill="var(--color-bg, #fff)" />
  </svg>
)
export const ExternalIcon = (p) => (
  <svg {...base} width="14" height="14" {...p}><path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
)
export const BackIcon = (p) => (
  <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
)
// A bare minus read as "collapse" or "remove one", not "hide this event" — and
// sat next to a bare chevron with no visual distinction between "go back" and
// "make it disappear". An eye-with-a-slash is the standard, unmistakable "hide
// this from my view", and it pairs with a text label rather than standing alone.
export const HideIcon = (p) => (
  <svg {...base} {...p}><path d="M3 3l18 18" /><path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.5" /><path d="M6.5 7.1C3.9 8.6 3 10.9 3 12c0 2.5 4 7 9 7a9.4 9.4 0 0 0 3.9-.85" /><path d="M9.9 10.1a3 3 0 0 0 4.1 4.2" /></svg>
)

export const UndoIcon = (p) => (
  <svg {...base} width="16" height="16" {...p}><path d="M4 8h10a5 5 0 0 1 0 10h-6" /><path d="M4 8l4-4M4 8l4 4" /></svg>
)

export const CalendarIcon = (p) => (
  <svg {...base} width="14" height="14" {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)

export const CheckIcon = (p) => (
  <svg {...base} width="14" height="14" {...p}><path d="M4 12.5l5 5L20 6.5" /></svg>
)
export const GuideIcon = (p) => (
  <svg {...base} {...p}><path d="M4 5.5c2-1 5-1 8 0 3-1 6-1 8 0v13c-2-1-5-1-8 0-3-1-6-1-8 0z" /><path d="M12 5.5v13" /></svg>
)

/** The wordmark's radar sweep, used as the empty-state mark too. */
export const RadarIcon = (p) => (
  <svg {...base} width="28" height="28" {...p}><circle cx="12" cy="12" r="9" opacity="0.35" /><circle cx="12" cy="12" r="5" opacity="0.6" /><path d="M12 12 18.5 7" /><circle cx="16.5" cy="9" r="1.4" fill="currentColor" stroke="none" /></svg>
)
