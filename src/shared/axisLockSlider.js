// A touch-safe drag handler for range sliders that live inside a vertically
// scrolling list (Touch Grass's Chorus, Yoru's mixer). A plain CSS
// `touch-action: pan-y` on a native <input type="range"> isn't reliably
// honoured on touch devices: the browser's own "drag the thumb" gesture for a
// form control arbitrates against page scrolling using its own, looser rules,
// and since a full-width slider leaves no scroll-safe margin, nearly every
// scroll swipe in the list starts on top of one — so it keeps winning against
// the user's intent to scroll.
//
// This hook takes touch interaction away from the native control entirely
// (paired with CSS `touch-action: none` on the input) and arbitrates the
// gesture itself: the first ~8px of movement decides whether it's a
// horizontal drag (adjust the slider) or vertical (scroll the list) — biased
// toward "it's a scroll" for anything ambiguous — and once decided, it never
// flips for the rest of that touch. Because touch-action is fully off, the
// browser won't scroll the list on its own for a touch that started on the
// slider, so a vertical decision manually forwards the delta to `scrollRef`.
//
// Mouse and pen are left alone: the hook no-ops for any pointerType other
// than 'touch', so the native input's own click/drag/keyboard handling (and
// the onChange prop already wired to it) keeps working exactly as before.
import { useCallback, useRef } from 'react'

const DEADZONE = 8 // px of initial movement before an axis is committed to

// pure — easy to unit test without simulating real pointer events
export function pickAxis(dx, dy, deadzone = DEADZONE) {
  if (Math.hypot(dx, dy) < deadzone) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

export function valueFromClientX(clientX, rect, min, max, step) {
  const pct = Math.min(1, Math.max(0, rect.width > 0 ? (clientX - rect.left) / rect.width : 0))
  const raw = min + pct * (max - min)
  const stepped = Math.round(raw / step) * step
  return Math.min(max, Math.max(min, stepped))
}

export function useAxisLockSlider({ min, max, step = 1, onValue, scrollRef }) {
  const gesture = useRef(null) // { startX, startY, lastY, rect, axis }

  const setFromX = useCallback(
    (clientX, rect) => onValue(valueFromClientX(clientX, rect, min, max, step)),
    [min, max, step, onValue]
  )

  const onPointerDown = useCallback((e) => {
    if (e.pointerType !== 'touch') return // mouse/pen: native handling is unaffected
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = { startX: e.clientX, startY: e.clientY, lastY: e.clientY, rect, axis: null }
    // setPointerCapture can throw if the browser considers the pointer no
    // longer active (a real edge case, e.g. a very fast tap); it's a nice-to-
    // have for keeping the gesture tracked once the finger drifts off the
    // element, not load-bearing for the axis-lock logic itself, so a failure
    // here shouldn't surface as an error.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch (_) {}
  }, [])

  const onPointerMove = useCallback((e) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (g.axis == null) {
      g.axis = pickAxis(dx, dy)
      if (g.axis == null) return // still inside the deadzone — undecided
    }
    e.preventDefault()
    if (g.axis === 'x') setFromX(e.clientX, g.rect)
    else if (scrollRef?.current) scrollRef.current.scrollTop -= e.clientY - g.lastY
    g.lastY = e.clientY
  }, [setFromX, scrollRef])

  const onPointerUp = useCallback((e) => {
    const g = gesture.current
    // a plain tap (never left the deadzone) jumps the value there, matching
    // the familiar "tap the track" affordance
    if (g && g.axis == null) setFromX(e.clientX, g.rect)
    gesture.current = null
  }, [setFromX])

  const onPointerCancel = useCallback(() => { gesture.current = null }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
