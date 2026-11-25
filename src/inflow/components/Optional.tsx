import styles from '../styles/ui.module.css'

/** Marks a tax figure as optional: useful if you want it, ignorable if you don't. */
export function Optional() {
  return (
    <span className={styles.optional} title="Optional. Turn tax tracking off in Settings to see only the money flow.">
      Optional
    </span>
  )
}
