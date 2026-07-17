import { useEffect, useRef } from 'react'
import styles from './InlinePopover.module.css'

// A tiny anchored popover — closes on outside pointer-down or Escape. Used for
// the frictionless, no-modal reassignment controls (day mover, skein chip).
export default function InlinePopover({ children, onClose, align = 'end' }) {
  const ref = useRef(null)
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', onDown)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className={`${styles.pop} ${align === 'start' ? styles.start : styles.end}`} ref={ref} role="dialog">
      {children}
    </div>
  )
}
