import { useCallback, useEffect, useState } from 'react'

// Reading, not following lights (the written view, and Read and play): the keys
// to play stay dark while she reads, and light up once she is stuck, so she is
// never left lost on the staff.

/** How long a step waits before its keys light up by themselves. */
export const STUCK_MS = 3000

/**
 * Whether she is stuck on the step in hand: after STUCK_MS on it, or at once
 * after a wrong key. It starts again whenever `step` (any string that changes
 * with the step) changes, and is never stuck while `active` is false.
 */
export function useStuck(step: string, active: boolean): { stuck: boolean; wrongKey: () => void } {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    setStuck(false)
    if (!active) return
    const timer = setTimeout(() => setStuck(true), STUCK_MS)
    return () => clearTimeout(timer)
  }, [step, active])
  const wrongKey = useCallback(() => setStuck(true), [])
  return { stuck: active && stuck, wrongKey }
}
