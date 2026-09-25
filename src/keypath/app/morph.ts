import { flushSync } from 'react-dom'
import './morph.css'

// A change of layout that should ease rather than jump: the setup folding away
// as the music starts, coming back when it stops, a prompt appearing between
// takes. The browser's view transitions do the easing: a snapshot of the screen
// before, the screen after, and a short cross-fade between them, with any part
// given a `view-transition-name` (the falling notes) moving on its own. Where
// view transitions aren't supported, the phone asks for less motion, or the
// page is hidden, the change is simply made.

let inside = false

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Make `update` (React state changes) as one eased transition of the screen. */
export function morph(update: () => void): void {
  // A morph inside another is part of the same change: one transition, not two.
  if (inside || typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible' || reduced()) {
    update()
    return
  }
  document.startViewTransition(() => {
    inside = true
    try {
      flushSync(update)
    } finally {
      inside = false
    }
  })
}
