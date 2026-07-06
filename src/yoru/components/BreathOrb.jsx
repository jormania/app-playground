import styles from './BreathOrb.module.css'

// A soft glowing orb that expands and settles with the breath. `scale` is 0..1
// (0 = settled/empty, 1 = fully expanded/full); it maps to a gentle size range
// so the orb never fully collapses or fills the screen.
export default function BreathOrb({ scale = 0, label }) {
  const s = 0.58 + 0.42 * Math.max(0, Math.min(1, scale))
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.orb} style={{ transform: `scale(${s.toFixed(4)})` }}>
        <div className={styles.core} />
      </div>
      <div className={styles.label}>{label}</div>
    </div>
  )
}
