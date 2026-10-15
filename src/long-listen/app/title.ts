import { useEffect } from 'react'

const APP = 'The Long Listen'
let shown = ''

/** What the screen on show is called ("This week", a work, a composer): what a link back to it is labelled. */
export const titleNow = (): string => shown

/** Name the screen: in the browser's title (then the app), and for a way back to it. Nothing yet: the app alone. */
export function setTitle(what: string | undefined): void {
  shown = what ?? ''
  document.title = what ? `${what} · ${APP}` : APP
}

/**
 * The browser's title for the screen: what is on it, then the app — so the
 * tab switcher, history and the phone's recent apps tell screens apart — and
 * the label of a link back to it from the next screen.
 */
export function useTitle(what: string | undefined): void {
  useEffect(() => { setTitle(what) }, [what])
}
