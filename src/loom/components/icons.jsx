// Small line-style SVG glyphs for the toolbar — icon-only controls, so a
// tooltip (title/aria-label, sourced from the lexicon) carries the meaning
// instead of a visible text label. Same drawing convention as the rest of the
// app's unicode glyphs: draw in `currentColor` at 1em so they inherit size/tint.
const base = {
  width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: false,
}

// Unwoven-only filter — an open knot, echoing the thread row's own circle.
export const UnwovenIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="7.5" /></svg>
)
// Top-of-group filter — a small heat ramp: three bars, tallest (hottest) first.
export const HotFewIcon = (p) => (
  <svg {...base} {...p}><path d="M5 19v-6M12 19V8M19 19v-3" /></svg>
)
// Fold-woven — a chevron tucking up under a line.
export const FoldIcon = (p) => (
  <svg {...base} {...p}><path d="M6 14.5l6-5.5 6 5.5" /><path d="M6 18.5h12" /></svg>
)
// Re-warp (carry-over) — a rewind/circular-arrow, the past-weeks sweep.
export const RewarpIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8" /><path d="M3.5 3.7V8h4.3" /></svg>
)
// Drafts — a duplicate/stack glyph: a saved set you weave again.
export const DraftsIcon = (p) => (
  <svg {...base} {...p}><path d="M8.5 3.5h9a2 2 0 0 1 2 2v9" /><rect x="4.5" y="8.5" width="11" height="11" rx="2" /></svg>
)
