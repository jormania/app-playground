import { useEffect, useState } from 'react'

/**
 * A phone on its side: the same condition the landscape layout uses (the
 * playing screens' CSS), so the keys widen exactly when the layout does. A
 * desktop or tablet window is left alone.
 */
export const WIDE_QUERY = '(orientation: landscape) and (max-height: 560px)'

/** Octaves a screen keyboard shows at least: three when wide, else whatever the screen asked for. */
export const WIDE_OCTAVES = 3

/** True while the screen is wide (see WIDE_QUERY); follows rotation. */
export function useWide(): boolean {
  const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null)
  const [wide, setWide] = useState(() => query()?.matches ?? false)
  useEffect(() => {
    const mq = query()
    if (!mq) return
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return wide
}
