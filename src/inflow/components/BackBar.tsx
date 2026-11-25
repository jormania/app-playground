import { useState } from 'react'
import { clearTrail, readTrail } from '../app/trail'
import styles from '../styles/ui.module.css'

/**
 * "← Back to Review": the one way back after a drill-down, above the page,
 * with a fine accent rule under it (The Long Listen's BackLink, plainer).
 */
export function BackBar() {
  const [trail] = useState(readTrail)
  if (!trail) return null
  return (
    <nav className={styles.backBar} aria-label="Back">
      <a href={trail.hash} className={styles.backLink} onClick={() => clearTrail()}>← Back to {trail.label}</a>
    </nav>
  )
}
