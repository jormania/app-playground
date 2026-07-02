const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
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

// Stats — three ascending bars.
export function IconStats(props) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M5 19V13" />
      <path d="M12 19V7" />
      <path d="M19 19V10" />
    </svg>
  )
}
