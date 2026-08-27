import { useRef, useState } from 'react'

export interface SwipeActionOptions {
  /** Horizontal distance, in px, a swipe must cross before it fires. */
  threshold?: number
  /** How much the drag keeps moving past `threshold` (0 = hard stop, 1 = no
   *  resistance at all) — the elastic-not-loose feel a real swipe needs. */
  resistance?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  disabled?: boolean
}

export interface SwipeActionState {
  /** The live horizontal offset to apply as `translateX(dx)`. */
  dx: number
  /** Which action is about to fire if the pointer lifts now, or null. */
  revealing: 'left' | 'right' | null
  bind: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: (e: React.PointerEvent) => void
  }
}

/**
 * A horizontal swipe-to-act gesture, generalized out of Loom's `ThreadRow` (its
 * swipe-right-to-weave / swipe-left-to-unravel row) once a second app needed
 * the same feel. Loom's own copy is untouched — it has no test proving the
 * gesture is behavior-preserving under a refactor, so this is a promotion in
 * the "extract the reusable shape" sense, not yet a re-export; migrating
 * ThreadRow onto this is future work once that test exists (`src/shared/`'s
 * own convention — see `notionId.ts`'s header for another promotion that left
 * an older copy in place rather than force an unproven migration).
 *
 * Vertical movement is handed straight back to the page's own scroll — the
 * axis is decided from the FIRST few pixels of movement and never revisited,
 * so a swipe can't be "stolen" mid-scroll or a scroll mid-swipe. Same shape
 * as `axisLockSlider.js`'s `pickAxis` (an 8px deadzone, then whichever axis
 * moved further); kept as its own small inline check rather than importing a
 * plain-JS helper into this typechecked file over three lines of logic.
 *
 * Call `bind` on whichever element should own the gesture (usually a card's
 * whole body, not the card's root) — anything inside that element a caller
 * wants exempt (a link, a button, a nested control) should stop the pointer
 * event reaching it, exactly as Loom's own `[data-loom-controls]` does.
 */
export function useSwipeAction({
  threshold = 72,
  resistance = 0.35,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
}: SwipeActionOptions = {}): SwipeActionState {
  const [dx, setDx] = useState(0)
  const gesture = useRef<{ startX: number; startY: number; axis: 'x' | 'y' | null; id: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, startY: e.clientY, axis: null, id: e.pointerId }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const mx = e.clientX - g.startX
    const my = e.clientY - g.startY
    if (!g.axis) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        g.axis = 'x'
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
      } else if (Math.abs(my) > 8) {
        g.axis = 'y' // vertical — hand it back to the scroller
        gesture.current = null
        setDx(0)
        return
      }
    }
    if (g.axis === 'x') {
      e.preventDefault()
      const clamped = Math.abs(mx) > threshold
        ? Math.sign(mx) * (threshold + (Math.abs(mx) - threshold) * resistance)
        : mx
      setDx(clamped)
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') { setDx(0); return }
    const mx = e.clientX - g.startX
    if (mx > threshold) onSwipeRight?.()
    else if (mx < -threshold) onSwipeLeft?.()
    setDx(0)
  }

  const revealing = dx > 4 ? 'right' : dx < -4 ? 'left' : null

  return { dx, revealing, bind: { onPointerDown, onPointerMove, onPointerUp } }
}
