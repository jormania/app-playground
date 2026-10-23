import { useCallback, useRef } from 'react'

/**
 * A tap that saves something (a new player, a song, a take) does it once: a
 * second tap while the first is still saving is let go. Without this, a quick
 * double tap made two players called Nora, or kept a take twice. One guard for
 * the screen: its saving actions take turns.
 */
export function useOnce() {
  const busy = useRef(false)
  return useCallback(
    <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
      async (...args: A): Promise<void> => {
        if (busy.current) return
        busy.current = true
        try {
          await fn(...args)
        } finally {
          busy.current = false
        }
      },
    [],
  )
}
