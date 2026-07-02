import styles from './CountdownRing.module.css'

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const TINT_BY_KIND = {
  work: 'var(--color-accent)',
  rest: 'var(--color-success)',
  prepare: 'var(--color-warning)',
}

// A circular countdown, depleting clockwise as the segment elapses — the
// strongest visual anchor on the screen you spend the most time looking at.
// Tempo-local (not DS): it's specific to "a fraction of a countdown", single
// caller. Promote it into src/ds/ if a second app ever wants a generic ring.
export function CountdownRing({ fractionRemaining, kind, children }) {
  const clamped = Math.min(1, Math.max(0, fractionRemaining))
  const offset = CIRCUMFERENCE * (1 - clamped)
  const tint = TINT_BY_KIND[kind] ?? 'var(--color-accent)'

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 100 100" className={styles.svg}>
        <circle cx="50" cy="50" r={RADIUS} strokeWidth="6" className={styles.track} fill="none" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          strokeWidth="6"
          fill="none"
          className={styles.progress}
          style={{ stroke: tint, strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset }}
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
