import styles from './CountdownRing.module.css'

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Thick enough to read at a glance in direct sunlight (outdoor screens wash
// out a thin line first) — was 6, room to spare before it'd crowd RADIUS.
const STROKE_WIDTH = 10

// Calm per-kind ring tints, harmonising with the family gradients. `active`
// (a Move segment, in Rounds or Custom) isn't listed here — it gets a
// dynamic cold-to-hot tint instead, see ACTIVE_TINTS below.
const TINT_BY_KIND = {
  prepare: '#d8a657', // amber
  rest: '#6fb08a', // sage
  focus: '#7076d8', // periwinkle
  sit: '#4e9e86', // deep sage
  walk: '#4fa6a0', // teal
  inhale: '#5fa3d6', // sky
  hold: '#9a8fd0', // lavender
  exhale: '#5fb6ac', // seafoam
}

// A Move segment's ring runs cold-to-hot over its own duration — a second,
// glanceable read on how far into the effort you are, without reading the
// clock: blue for the first half, amber for the next quarter, red for the
// last quarter (the "kick" everyone recognises). One continuous arc, same as
// every other kind — the colour itself just switches at the two thresholds.
const ACTIVE_COOL = '#4a90d9'
const ACTIVE_WARM = '#e8973a'
const ACTIVE_HOT = '#d6473f'

function tintFor(kind, fractionRemaining) {
  if (kind === 'active') {
    if (fractionRemaining > 0.5) return ACTIVE_COOL
    if (fractionRemaining > 0.25) return ACTIVE_WARM
    return ACTIVE_HOT
  }
  return TINT_BY_KIND[kind] ?? 'var(--color-accent)'
}

// A circular countdown, depleting clockwise as the segment elapses — the
// strongest visual anchor on the screen you spend the most time looking at.
// Tempo-local (not DS): it's specific to "a fraction of a countdown", single
// caller. Promote it into src/ds/ if a second app ever wants a generic ring.
export function CountdownRing({ fractionRemaining, kind, pulsing = false, children }) {
  const clamped = Math.min(1, Math.max(0, fractionRemaining))
  // Negative, not (1 - clamped): a positive offset here reveals the arc
  // starting at 12 o'clock and eats it away from the *far* end backwards,
  // which reads as counterclockwise depletion. Negating it eats the arc
  // starting at 12 o'clock instead, so the ring empties clockwise.
  const offset = -CIRCUMFERENCE * (1 - clamped)
  const tint = tintFor(kind, clamped)

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 100 100" className={styles.svg}>
        <circle cx="50" cy="50" r={RADIUS} strokeWidth={STROKE_WIDTH} className={styles.track} fill="none" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          className={`${styles.progress} ${pulsing ? styles.pulsing : ''}`}
          style={{ stroke: tint, strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset, '--pulse-color': tint }}
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
