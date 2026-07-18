import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './InlinePopover.module.css'

// A tiny anchored popover for the frictionless, no-modal reassignment controls
// (day mover, skein chip). It renders in a PORTAL with fixed positioning measured
// from its anchor, then clamps itself inside the viewport and flips above when
// there's no room below — so it never gets clipped by the week's horizontal
// scroll container or truncated off the screen edge on a laptop. Closes on an
// outside pointer-down or Escape.
export default function InlinePopover({ children, onClose, anchorRef }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef && anchorRef.current
      const el = ref.current
      if (!anchor || !el) return
      const a = anchor.getBoundingClientRect()
      const p = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const m = 8
      // Right-align to the anchor, then clamp within the viewport.
      let left = a.right - p.width
      left = Math.max(m, Math.min(left, vw - p.width - m))
      // Prefer below the anchor; flip above if it would overflow the bottom.
      let top = a.bottom + 6
      if (top + p.height > vh - m) {
        const above = a.top - p.height - 6
        top = above >= m ? above : Math.max(m, vh - p.height - m)
      }
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    // capture:true so it also tracks the week's own horizontal scroll container.
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorRef])

  useEffect(() => {
    function onDown(e) {
      const anchor = anchorRef && anchorRef.current
      if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains(e.target))) onClose()
    }
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
  }, [onClose, anchorRef])

  return createPortal(
    <div
      className={styles.pop}
      ref={ref}
      role="dialog"
      style={{
        position: 'fixed',
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
