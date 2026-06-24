// Small line-style SVG glyphs. Field icons sit beside field names (per spec);
// UI icons live in the menu bar. All draw in `currentColor` at 1em so they take
// the colour and size of their surrounding text.
const base = {
  width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: false,
}

// ── Field glyphs ──────────────────────────────────────────────
// Title — a quill nib catching the small thing.
export const TitleIcon = (p) => (
  <svg {...base} {...p}><path d="M4 20s2-1 5-4l9-9-2-2-9 9c-3 3-4 5-4 5z" /><path d="M14 5l3 3" /></svg>
)
// Date — a calendar leaf.
export const DateIcon = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></svg>
)
// Tags — emergent motifs, not a fixed taxonomy: a single tag.
export const TagIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 11.5l8-8 9 1 1 9-8 8z" /><circle cx="15.5" cy="8.5" r="1.4" /></svg>
)
// People — kept separate from tags.
export const PeopleIcon = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.7c2.2.6 3.5 2.6 3.5 5.3" /></svg>
)
// Entry — the essayette itself.
export const EntryIcon = (p) => (
  <svg {...base} {...p}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M13.5 3.5V8h4.5M8 13h8M8 16.5h5" /></svg>
)
// Word count — Notion's read-only tally.
export const CountIcon = (p) => (
  <svg {...base} {...p}><path d="M5 6h6M5 10h9M5 14h6M5 18h9" /><path d="M17 5l2 2 3-3.5" /></svg>
)

// ── UI glyphs ─────────────────────────────────────────────────
export const ListIcon = (p) => (
  <svg {...base} {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
)
export const CalendarIcon = DateIcon
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
// Stats — a small bar chart.
export const StatsIcon = (p) => (
  <svg {...base} {...p}><path d="M5 21V11M12 21V4M19 21v-6" /><path d="M3 21h18" /></svg>
)
// Export — a download / save-out arrow into a tray.
export const ExportIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3v11M8 10l4 4 4-4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
)
// On this day — a clock turning back.
export const HistoryIcon = (p) => (
  <svg {...base} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>
)
// Year — a grid of days.
export const YearIcon = (p) => (
  <svg {...base} {...p}><path d="M4 6h2M9 6h2M14 6h2M19 6h1M4 10h2M9 10h2M14 10h2M19 10h1M4 14h2M9 14h2M14 14h2M4 18h2M9 18h2" /></svg>
)
// More — three dots, for the mobile overflow menu.
export const MoreIcon = (p) => (
  <svg {...base} {...p}><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg>
)
