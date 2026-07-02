// Calm, cohesive line marks — all 24×24, currentColor stroke, rounded caps.
// Deliberately organic/quiet rather than mechanical (no gears, no wrench).

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

// Rounds — Move (a pulse/heartbeat line: effort, rhythm) and Rest (a short
// pause between rounds — not sitting down, just not moving for a beat).
export function IconMove(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M2 12h4l2-5 3.5 10L14 8l2 4h6" />
    </svg>
  )
}

export function IconPause(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <rect x="7" y="5" width="4" height="14" rx="1.6" />
      <rect x="14" y="5" width="4" height="14" rx="1.6" />
    </svg>
  )
}

// Cycles — Focus (a clock face: timed attention) and Break (a cup — stepping
// away from the work, not a workout rest and not a meditative sit).
export function IconFocus(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V7" />
      <path d="M12 12h4" />
    </svg>
  )
}

export function IconBreak(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
      <path d="M16 10.6h1.6a2.4 2.4 0 0 1 0 4.8H16" />
    </svg>
  )
}

// Custom — a short stack of segments of different lengths: a built sequence.
export function IconCustom(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 7h14" />
      <path d="M4 12h9" />
      <path d="M4 17h11" />
    </svg>
  )
}

// Sit–Walk — Sit (a seated figure over the ground) and Walk (a pair of
// footprints, mid-stride): the two states of the one practice, in order.
export function IconSit(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="6.5" r="2.4" />
      <path d="M5 18c2.5-5 11.5-5 14 0" />
      <path d="M4.5 18.5h15" />
    </svg>
  )
}

export function IconWalk(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <ellipse cx="9" cy="16.5" rx="2.4" ry="3.8" transform="rotate(-18 9 16.5)" />
      <ellipse cx="16" cy="8.5" rx="2.4" ry="3.8" transform="rotate(18 16 8.5)" />
    </svg>
  )
}

// 4-7-8 — expanding ripples: the slow widening of the breath.
export function IconBreath(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="6" opacity="0.7" />
      <circle cx="12" cy="12" r="9.5" opacity="0.4" />
    </svg>
  )
}

// Box breathing — a square path with a bead at the corner: the even four-count loop.
export function IconBox(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <circle cx="5" cy="5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Reorder — up/down arrows, for the drag-free "change order" control.
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

// Guide — an open book.
export function IconGuide(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M12 7c-1.7-1-3.7-1.4-5.7-1.1A1 1 0 0 0 5.5 7v9.2c0 .6.5 1.05 1.1.95 1.8-.3 3.6.1 5.4 1.05 1.8-.95 3.6-1.35 5.4-1.05.6.1 1.1-.35 1.1-.95V7a1 1 0 0 0-.8-1.1C15.7 5.6 13.7 6 12 7Z" />
      <path d="M12 7v9.5" />
    </svg>
  )
}

// Stemmed move arrows — clear "move this up / down" signalling for reordering.
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

// The Tempo mark — an open ring (breath/rhythm) with a settling bead.
export function TempoMark(props) {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M20 12a8 8 0 1 1-4-6.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  )
}
