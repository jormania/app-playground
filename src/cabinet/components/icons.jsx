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
