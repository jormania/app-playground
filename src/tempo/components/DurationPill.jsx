import { IconFocus } from './icons'
import { formatDuration } from '../lib/duration'
import styles from './DurationPill.module.css'

// The one place the "how long is this practice" pill is styled — used on
// every setup screen (live, as the user configures) and on the done screen
// (final total), so the same number reads the same way everywhere.
export function DurationPill({ seconds, className }) {
  return (
    <div className={className ? `${styles.pill} ${className}` : styles.pill}>
      <IconFocus width={16} height={16} className={styles.icon} />
      <span>{formatDuration(seconds)}</span>
    </div>
  )
}
