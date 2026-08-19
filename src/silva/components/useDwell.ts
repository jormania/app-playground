import { useEffect, useRef } from 'react'

/** Half the plate on screen, for a beat and a half. Below this it isn't
 *  reading, it's scrolling past — and a "seen" history that a fast scroll can
 *  fill with fifty things is worthless within a week. */
export const DWELL_VISIBLE_RATIO = 0.5
export const DWELL_MS = 1500

export interface DwellOptions {
  /** Fired once, the first time the element is dwelled on. */
  onSeen: () => void
  /** Skip observing entirely (e.g. this thing is already recorded for today). */
  disabled?: boolean
}

/**
 * Calls `onSeen` when an element has genuinely been looked at, rather than
 * merely rendered.
 *
 * "Seen" is the one definition in this feature that cannot be revised later:
 * history accumulates, and a signal corrupted by scroll-past can't be repaired
 * retroactively. So the bar is deliberately conservative — a plate has to be
 * half on screen and stay there. Scrolling straight past a thing records
 * nothing, which is correct: you didn't read it.
 *
 * Fires at most once per mount. Where the browser has no IntersectionObserver,
 * nothing is ever recorded and every thing falls back to its `kept` date —
 * degraded, never wrong.
 */
export function useDwell({ onSeen, disabled = false }: DwellOptions) {
  const ref = useRef<HTMLElement | null>(null)
  // Kept in a ref so a re-render with a new closure doesn't tear down and
  // restart the timer — which, on a list that re-renders while you read,
  // would mean the dwell never completes.
  const onSeenRef = useRef(onSeen)
  onSeenRef.current = onSeen

  useEffect(() => {
    const element = ref.current
    if (disabled || !element || typeof IntersectionObserver === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | null = null
    let done = false

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (done) return
          if (entry.isIntersecting && entry.intersectionRatio >= DWELL_VISIBLE_RATIO) {
            if (timer === null) {
              timer = setTimeout(() => {
                done = true
                clear()
                observer.disconnect()
                onSeenRef.current()
              }, DWELL_MS)
            }
          } else {
            // Left the window before the beat was up — it doesn't count, and
            // the next visit starts the clock again from zero.
            clear()
          }
        }
      },
      { threshold: [DWELL_VISIBLE_RATIO] },
    )

    observer.observe(element)
    return () => {
      clear()
      observer.disconnect()
    }
  }, [disabled])

  return ref
}
