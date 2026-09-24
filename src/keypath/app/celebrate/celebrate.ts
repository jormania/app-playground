import { triggerHaptic } from '../../../shared/haptics'

// Celebrations: confetti and a buzz for the moments that deserve one (the way
// Lexi5 celebrates a Crown). Kept for real wins, so they stay special: a song
// finished, three stars, a Journey step passed, a new best. Never for a
// single right note — that's what the streak counter is for.

export type Moment = 'finished' | 'threeStars' | 'stepPassed' | 'journeyDone' | 'newBest' | 'echoPassed' | 'connected'

/** The four doors' colours plus the icon's gold star. */
const COLOURS = ['#e0795b', '#4f9d8a', '#d9a520', '#8a6fd1', '#f2c14e']

type Burst = { particleCount: number; spread: number; startVelocity?: number; scalar?: number; shapes?: ('star' | 'circle' | 'square')[]; origin: { x?: number; y: number }; angle?: number }

const BURSTS: Record<Moment, Burst[]> = {
  finished: [{ particleCount: 60, spread: 70, origin: { y: 0.65 } }],
  threeStars: [
    { particleCount: 90, spread: 80, shapes: ['star'], scalar: 1.2, origin: { y: 0.6 } },
    { particleCount: 40, spread: 55, angle: 60, origin: { x: 0, y: 0.75 } },
    { particleCount: 40, spread: 55, angle: 120, origin: { x: 1, y: 0.75 } },
  ],
  stepPassed: [{ particleCount: 70, spread: 75, origin: { y: 0.55 } }],
  journeyDone: [
    { particleCount: 120, spread: 100, shapes: ['star'], scalar: 1.3, origin: { y: 0.5 } },
    { particleCount: 60, spread: 60, angle: 60, origin: { x: 0, y: 0.8 } },
    { particleCount: 60, spread: 60, angle: 120, origin: { x: 1, y: 0.8 } },
  ],
  newBest: [{ particleCount: 80, spread: 70, shapes: ['star'], origin: { y: 0.45 } }],
  echoPassed: [{ particleCount: 30, spread: 50, startVelocity: 25, origin: { y: 0.4 } }],
  connected: [{ particleCount: 40, spread: 60, startVelocity: 30, origin: { y: 0.5 } }],
}

/** Motion is off for anyone who asked their phone for less of it, and in test runners. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (import.meta.env?.MODE === 'test' || /jsdom|happy-?dom/i.test(navigator.userAgent || '')) return false
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/** For tests: every moment celebrated, in order. */
export const celebrated: Moment[] = []

export function celebrate(moment: Moment): void {
  celebrated.push(moment)
  triggerHaptic(moment === 'echoPassed' || moment === 'connected' ? 'light' : 'success')
  if (!motionAllowed()) return
  // Loaded on demand, like Lexi5: the library is only needed once there is something to celebrate.
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      BURSTS[moment].forEach((b, i) => setTimeout(() => void confetti({ ...b, colors: COLOURS, disableForReducedMotion: true, zIndex: 50 }), i * 180))
    })
    .catch(() => {})
}
