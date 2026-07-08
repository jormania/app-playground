// Line-style SVG glyphs, drawn in currentColor at 1em so they take the colour and size
// of their surrounding text. Field glyphs sit beside field names; UI glyphs live in the
// menu bar and actions. Wanderlist's own set — an atlas/exploration flavour.
const base = {
  width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: false,
}

// ── Field glyphs ──────────────────────────────────────────────
// Name — a compass-nib / marker.
export const NameIcon = (p) => (
  <svg {...base} {...p}><path d="M4 20s2-1 5-4l9-9-2-2-9 9c-3 3-4 5-4 5z" /><path d="M14 5l3 3" /></svg>
)
// Description — lines of text on a page.
export const TextIcon = (p) => (
  <svg {...base} {...p}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M13.5 3.5V8h4.5M8 13h8M8 16.5h5" /></svg>
)
// Category — a folder / bucket.
export const CategoryIcon = (p) => (
  <svg {...base} {...p}><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.2h8.5A1.5 1.5 0 0 1 21 9.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" /></svg>
)
// Place — a map pin.
export const PlaceIcon = (p) => (
  <svg {...base} {...p}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
)
// Tags — a single tag; emergent motifs, not a fixed taxonomy.
export const TagIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 11.5l8-8 9 1 1 9-8 8z" /><circle cx="15.5" cy="8.5" r="1.4" /></svg>
)
// Link — a chain.
export const LinkIcon = (p) => (
  <svg {...base} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" /></svg>
)
// Map — folded map (the pin's Maps link).
export const MapIcon = (p) => (
  <svg {...base} {...p}><path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></svg>
)
// Expiry — an hourglass; the deadline to act.
export const HourglassIcon = (p) => (
  <svg {...base} {...p}><path d="M6 3h12M6 21h12" /><path d="M7 3c0 4 5 5 5 9s-5 5-5 9M17 3c0 4-5 5-5 9s5 5 5 9" /></svg>
)
// When — a calendar leaf (the event's own date).
export const CalendarIcon = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></svg>
)
// Photo — a single snapshot, at most one per item.
export const PhotoIcon = (p) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10.5" r="2" /><path d="M21 16l-5.5-5-4 4-2-1.5L3 17" /></svg>
)
// Ticket — a stub with a torn/perforated edge.
export const TicketIcon = (p) => (
  <svg {...base} {...p}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3z" /><path d="M14 7v10" strokeDasharray="2 2" /></svg>
)
// Attended — a check inside a ring.
export const CheckCircleIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.2l2.4 2.4 4.6-4.8" /></svg>
)
export const CheckIcon = (p) => (<svg {...base} {...p}><path d="M5 12.5l4.2 4.2L19 7" /></svg>)

// ── UI glyphs ─────────────────────────────────────────────────
export const ListIcon = (p) => (
  <svg {...base} {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
)
export const PlusIcon = (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>)
export const BackIcon = (p) => (<svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>)
export const GuideIcon = (p) => (
  <svg {...base} {...p}><path d="M4 5.5A2 2 0 0 1 6 4h6v16H6a2 2 0 0 0-2 1.5z" /><path d="M20 5.5A2 2 0 0 0 18 4h-6v16h6a2 2 0 0 1 2 1.5z" /></svg>
)
export const GearIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>
)
export const CloseIcon = (p) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>)
export const SearchIcon = (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>)
export const MoreIcon = (p) => (
  <svg {...base} {...p}><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg>
)
export const StatsIcon = (p) => (
  <svg {...base} {...p}><path d="M5 21V11M12 21V4M19 21v-6" /><path d="M3 21h18" /></svg>
)
export const SortIcon = (p) => (
  <svg {...base} {...p}><path d="M7 5v14M7 19l-3-3M7 5l3 3M17 19V5M17 5l-3 3M17 19l3-3" /></svg>
)
// External-link arrow (opens the event page / map).
export const ExternalIcon = (p) => (
  <svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
)
// Sun / Moon — the light/dark toggle. Each shows the mode you'll switch TO.
export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>
)
export const MoonIcon = (p) => (
  <svg {...base} {...p}><path d="M21 12.8A8 8 0 1 1 11.2 3a6.4 6.4 0 0 0 9.8 9.8z" /></svg>
)
// Share — the classic three-nodes glyph (OS share sheet / copy).
export const ShareIcon = (p) => (
  <svg {...base} {...p}><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" /></svg>
)

// ── Category glyphs (small icon per known category — see categoryIcons.js) ─────
// Idea — a lightbulb.
export const BulbIcon = (p) => (
  <svg {...base} {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.3 1.1 2.1h4.8c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z" /></svg>
)
// Movie — a clapperboard.
export const FilmIcon = (p) => (
  <svg {...base} {...p}><path d="M3 9.5l1.4-4.2a1 1 0 0 1 1-.7L20 5.8a1 1 0 0 1 .9 1.3l-1 3.4" /><rect x="3" y="9.5" width="18" height="11" rx="1.5" /><path d="M6 5.2l3 4.3M11 4.6l3 4.9M16 4l2.6 5.5" /></svg>
)
// Art — a palette.
export const PaletteIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3a9 8 0 1 0 0 16c1.4 0 2-1 2-2 0-.6-.3-1-.6-1.4-.3-.4-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-3.3-4-6-9-6z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none" /></svg>
)
// Discovery — a compass needle.
export const CompassIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>
)
