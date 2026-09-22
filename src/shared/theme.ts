// The theme *mechanism*, shared. Not the vocabulary.
//
// Ten apps have a theme module and six wrap it in a provider, but what a theme
// *is* differs on purpose: Cabinet and Law of the Day are light/dark, Tempo and
// Daily Stoic are three-way with `system`, Loom and Sol Odyssey are palette
// presets with their own arrays. Flattening those into one API would be a
// behaviour change wearing a refactor's clothes (R-015). So only the two pieces
// that were genuinely written out over and over live here: the `matchMedia`
// probe, and the persist-and-sync effect pair.
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * Does the OS ask for a dark palette right now?
 *
 * Never throws: an environment with no `matchMedia`, or one that rejects the
 * query, reads as light. `win` exists for tests and for the server — Silva's
 * copy took it and the other six didn't, so the shared version keeps it
 * optional and defaults to the real window.
 */
export function systemPrefersDark(
  win: Window | undefined = typeof window === 'undefined' ? undefined : window
): boolean {
  try {
    return Boolean(win?.matchMedia('(prefers-color-scheme: dark)').matches)
  } catch {
    return false
  }
}

interface ThemeSync<T> {
  /** Read the stored preference. Called on mount and on every cross-tab change. */
  load: () => T
  /** Persist it. Called whenever the value changes, after `apply`. */
  save: (value: T) => void
  /** Put it on the document. Called whenever the value changes, before `save`. */
  apply: (value: T) => void
}

/**
 * Hold a theme preference in state, apply and persist it on every change, and
 * follow it when another tab — or this app's own static guide page — writes the
 * same storage key.
 *
 * Returns the usual `[value, setValue]`, so callers keep their own vocabulary:
 * a `toggle` built on `setValue(toggleTheme)`, a `cycle` on `setValue(nextTheme)`,
 * whatever the app's theme module already exports.
 */
export function useThemeSync<T>(
  key: string,
  { load, save, apply }: ThemeSync<T>
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(load)

  useEffect(() => {
    apply(value)
    save(value)
    // `apply` and `save` are stable module functions in every caller; listing
    // them would re-run this on each render for the ones defined inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, setValue]
}

/**
 * Follow the OS colour scheme while `active`, calling `onChange` each time it
 * flips — the phone that turns dark at sunset taking the app with it.
 *
 * Promoted from Law of the Day (R-026), which is the version worth having:
 * Tempo's and Daily Stoic's copies call `matchMedia` bare and assume
 * `addEventListener` exists on a MediaQueryList, which Safari before 14 does
 * not provide. Both guards are kept here.
 *
 * Only the subscription is shared. **What to do on a change stays with the
 * caller**, because the three apps genuinely differ: one repaints, one only
 * re-syncs the browser-chrome tint because its palette swaps in CSS, one does
 * both. A hook that decided that for them would be the flattened
 * one-API-for-everything R-015 refused.
 *
 * `onChange` is held in a ref, so the subscription depends on `active` alone.
 * Callers can pass an inline arrow — all of them naturally would — without
 * tearing the listener down and rebuilding it on every render.
 */
export function useSystemThemeFollow(active: boolean, onChange: () => void): void {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    if (!active) return

    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      // No matchMedia, or a browser that refuses the query: the app keeps
      // whatever it last painted rather than failing to mount.
      return
    }

    const handler = () => latest.current()

    // Safari < 14 has no addEventListener on a MediaQueryList.
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else mq.addListener(handler)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else mq.removeListener(handler)
    }
  }, [active])
}
