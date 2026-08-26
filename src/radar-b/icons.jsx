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

/** Shown in the masthead when the status line has nothing to report — see
 *  App.jsx's `refreshedLine`. The button has to stay tappable even with no
 *  text in it, and a glyph is the honest alternative to a label reading
 *  "everything is normal". */
export const RefreshIcon = (p) => (
  <svg {...base} width="15" height="15" {...p}><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></svg>
)

/** The radar sweep, used as the empty-state mark. Stroked in `currentColor`,
 *  unlike `BeeMark` — an empty state should recede into `--color-faint`, not
 *  arrive in full poster colour. */
export const RadarIcon = (p) => (
  <svg {...base} width="28" height="28" {...p}><circle cx="12" cy="12" r="9" opacity="0.35" /><circle cx="12" cy="12" r="5" opacity="0.6" /><path d="M12 12 18.5 7" /><circle cx="16.5" cy="9" r="1.4" fill="currentColor" stroke="none" /></svg>
)

/**
 * The bee, at letterform scale — this is the `B` of Radar-B.
 *
 * Same five flats as `public/radar-b-logo.svg` and the launcher tile, and
 * deliberately NOT `currentColor`: the bee is the identity, so it stays green /
 * amber / pink wherever it lands, on either theme. It carries no ring venation
 * — below about 40px those rings turn to mud and fray the wing edge, which is
 * why the small mark and the tile are two drawings of one bee rather than one
 * drawing at two sizes.
 *
 * Decorative here: the wordmark's own `aria-label` says "Radar-B", so this is
 * `aria-hidden` and screen readers never meet a bee where a letter should be.
 */
export const BeeMark = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
       aria-hidden="true" focusable="false" {...p}>
    <path d="M29 27 Q17 28 10 36 Q4 44 13 47 Q23 50 28 38 Q31 31 29 27 Z" fill="#3b6b47" />
    <path d="M35 27 Q47 28 54 36 Q60 44 51 47 Q41 50 36 38 Q33 31 35 27 Z" fill="#3b6b47" />
    <ellipse cx="32" cy="37" rx="8.5" ry="16.5" fill="#e8a33d" />
    <g fill="var(--color-bg)">
      <rect x="23.5" y="26" width="17" height="3.4" />
      <rect x="23.5" y="33.5" width="17" height="3.4" />
      <rect x="23.5" y="41" width="17" height="3.4" />
    </g>
    <circle cx="27.4" cy="17.5" r="5.6" fill="#efa3b1" />
    <circle cx="36.6" cy="17.5" r="5.6" fill="#efa3b1" />
  </svg>
)
