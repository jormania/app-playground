/**
 * Silva's light/dark choice — light, dark, or "follow the OS" (the default).
 *
 * SILVA.md only ever asked for "light and dark, syncing to the device," and
 * for a long time that's all this module did: mirror `prefers-color-scheme`
 * with no way to override it. But syncing should be the *default*, not the
 * only option (Lexi5's `lib/config.ts` sets the same precedent) — a phone
 * that flips dark at sunset shouldn't drag a reading app along with it when
 * the reader would rather it stayed put. So the stored choice is
 * `'light' | 'dark' | null`, where **null means follow the OS**.
 *
 * Keep the values here in step with the inline FOUC script in
 * `silva-react.html` — both read the same `silva:theme` localStorage key on
 * the same origin, so one choice drives every page without a page reload.
 */

import { readJson, writeJson } from '../../shared/storage'

export type ThemeChoice = 'light' | 'dark' | null
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'silva:theme'

/** Does the OS currently prefer dark? False anywhere matchMedia is absent
 *  rather than throwing. */
export function systemPrefersDark(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  try {
    return Boolean(win?.matchMedia('(prefers-color-scheme: dark)').matches)
  } catch {
    return false
  }
}

/** The palette a choice actually resolves to right now. */
export function resolveTheme(choice: ThemeChoice, win?: Window): ResolvedTheme {
  if (choice === 'light' || choice === 'dark') return choice
  return systemPrefersDark(win) ? 'dark' : 'light'
}

/** Reads the stored choice, treating anything unrecognised as "follow the
 *  OS" rather than guessing a palette. */
export function loadThemeChoice(): ThemeChoice {
  const raw = readJson<unknown>(THEME_KEY, null)
  return raw === 'light' || raw === 'dark' ? raw : null
}

export function saveThemeChoice(choice: ThemeChoice): void {
  writeJson(THEME_KEY, choice)
}

/** Puts a resolved palette on the document via the `data-theme` attribute
 *  DS's tokens.css already reads. Safe to call with no DOM. */
export function applyTheme(theme: ResolvedTheme, doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc) return
  doc.documentElement.dataset.theme = theme
}

/**
 * Applies a choice and, only while that choice is "follow the OS", keeps
 * following it — a tab left open across sunset should change with the
 * phone. Returns a cleanup that detaches the listener; call this again
 * whenever the choice itself changes.
 */
export function watchTheme(choice: ThemeChoice, doc: Document = document, win: Window = window): () => void {
  applyTheme(resolveTheme(choice, win), doc)
  if (choice !== null) return () => {}

  let media: MediaQueryList
  try {
    media = win.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return () => {}
  }
  const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light', doc)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
