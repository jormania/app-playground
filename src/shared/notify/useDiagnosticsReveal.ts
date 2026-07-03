// The "N quick taps reveal a hidden diagnostics panel" gesture, generalized from Touch
// Grass's seven-tap easter egg on its API-key hint (itself modeled on Android's own
// build-number trick) — a way to see why a background notification went quiet without a
// laptop + devtools.
import { useRef } from 'react'

/** Returns a tap handler: call it on every tap of the trigger element. Once `tapCount` taps
 *  land within `windowMs` of each other, `onReveal` fires and the count resets. */
export function useDiagnosticsReveal(onReveal: () => void, tapCount = 7, windowMs = 2500): () => void {
  const state = useRef({ count: 0, last: 0 })
  return () => {
    const now = Date.now()
    const { count: prevCount, last } = state.current
    const count = now - last < windowMs ? prevCount + 1 : 1
    if (count >= tapCount) {
      state.current = { count: 0, last: now }
      onReveal()
    } else {
      state.current = { count, last: now }
    }
  }
}
