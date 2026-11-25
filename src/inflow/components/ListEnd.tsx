import styles from '../styles/ui.module.css'

/** Where a long list ends: The Long Listen's fleuron, then what it held. */
export function ListEnd({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.listEnd}>
      <div className={styles.fleuron} aria-hidden><span /></div>
      <div>{children}</div>
    </div>
  )
}
