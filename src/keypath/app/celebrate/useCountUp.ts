import { useEffect, useState } from 'react'
import { motionAllowed } from './celebrate'

/**
 * A number that counts up to `end` over `ms` (WhereItWent's odometer). Shows
 * `end` straight away where motion is off, and in test runners.
 */
export function useCountUp(end: number, ms = 900): number {
  const [value, setValue] = useState(() => (motionAllowed() ? 0 : end))
  useEffect(() => {
    if (!motionAllowed() || end <= 0) {
      setValue(end)
      return
    }
    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setValue(Math.round(end * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [end, ms])
  return value
}
