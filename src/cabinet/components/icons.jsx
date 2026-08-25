// Drag-free reordering controls — same marks as Tempo's ModePicker.

const base = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconReorder(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M7 20V6" />
      <path d="M4 9l3-3 3 3" />
      <path d="M17 4v14" />
      <path d="M14 15l3 3 3-3" />
    </svg>
  )
}

export function IconArrowUp(props) {
  return (
    <svg {...base} strokeWidth={2} {...props} aria-hidden>
      <path d="M12 5v14M6 11l6-6 6 6" />
    </svg>
  )
}

export function IconArrowDown(props) {
  return (
    <svg {...base} strokeWidth={2} {...props} aria-hidden>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  )
}

export function IconMore(props) {
  return (
    <svg {...base} strokeWidth={2.4} strokeLinecap="round" {...props} aria-hidden>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconQrCode(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20.5 14v3M14 20.5h3M20.5 20.5v.01" />
    </svg>
  )
}

// ── Sort-mode marks ─────────────────────────────────────────────────────────
// Shown instead of the words below 560px, where four labels can't share a row
// with search (see App.module.css). Deliberately NOT arrows for Manual: the
// reorder button sits immediately to the right already wearing ↑↓, and two
// adjacent arrow glyphs meaning different things is worse than no icon at all.
// A–Z keeps its word — it's already as short as a mark.

export function IconManual(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function IconRecent(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function IconPopular(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z" />
    </svg>
  )
}
