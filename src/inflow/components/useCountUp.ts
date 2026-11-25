import { useEffect, useRef, useState } from 'react'

/**
 * A figure that runs up to its value (and from one value to the next) over
 * about 700 ms, eased. Instant under "reduce motion" and wherever there is no
 * animation frame (tests, print).
 */
export function useCountUp(value: number, ms = 700): number {
  const still = typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined'
    || import.meta.env.MODE === 'test' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(still ? value : 0)
  const from = useRef(still ? value : 0)
  useEffect(() => {
    if (still) { setShown(value); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const v = a + (value - a) * e
      setShown(k === 1 ? value : Math.round(v))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, ms, still])
  return shown
}
