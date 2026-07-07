import { useEffect, useState } from 'react'
import styles from './Ended.module.css'

// The close: a dark, quiet screen. No stats, no streak, nothing to do. It fades
// in, sits, and a single tap returns home — but there's no reason to. The wake
// lock was released when the session ended, so the device screen is free to
// sleep now and truly power down to save battery.
export default function Ended({ name, onClose }) {
  const [ready, setReady] = useState(false)
  // Don't let the very tap that ended the night immediately dismiss this.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // If it's just left sitting — you dozed off looking at it — let it return home
  // on its own after a minute, so nothing lingers on screen through the night.
  useEffect(() => {
    const t = setTimeout(onClose, 60000)
    return () => clearTimeout(t)
  }, [onClose])

  const who = (name || '').trim()

  return (
    <button
      type="button"
      className={styles.ended}
      onClick={ready ? onClose : undefined}
      aria-label="Close"
    >
      <span className={styles.mark}>夜</span>
      <span className={styles.word}>{who ? `goodnight, ${who}` : 'goodnight'}</span>
    </button>
  )
}
