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
export const useWide = (): boolean => useMedia(WIDE_QUERY)

/** A screen taller than it is wide: the written view stacks its two bars there. */
export const PORTRAIT_QUERY = '(orientation: portrait)'

const mediaQuery = (q: string) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null)

/** True while a media query matches; follows rotation. */
export function useMedia(q: string): boolean {
  const query = () => mediaQuery(q)
  const [matches, setMatches] = useState(() => query()?.matches ?? false)
  useEffect(() => {
    const mq = mediaQuery(q)
    if (!mq) return
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [q])
  return matches
}
