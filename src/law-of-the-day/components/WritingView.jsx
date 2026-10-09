import styles from './WritingView.module.css'

// Shown in the scenario's place while Claude writes today's. Three ruled lines
// fill in turn, like ink going down, so the wait reads as work, not a freeze.
export function WritingView() {
  return (
    <div className={styles.view} role="status" aria-live="polite">
      <p className={styles.eyebrow}>Today&rsquo;s scenario</p>
      <div className={styles.page} aria-hidden>
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
      </div>
      <p className={styles.caption}>Writing today&rsquo;s scenario…</p>
    </div>
  )
}
