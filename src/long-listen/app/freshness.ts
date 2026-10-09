import { useEffect, useState } from 'react'

/**
 * Has a newer build been deployed since this page loaded? Moving between
 * sections never reloads the page, so a phone tab left open ran old code for
 * hours after fixes had shipped (2026-10-09: "Set aside for now" and "not yet
 * heard" still showing after both were renamed). The app's HTML is fetched
 * fresh and its entry script compared with the one running; a difference
 * means a new deploy. Production only, where the entry script's name carries
 * a content hash.
 */
const PAGE = '/long-listen-react.html'
const EVERY_MS = 5 * 60_000

/** The hashed entry script an HTML document loads, or null. */
export function entryScript(html: string): string | null {
  const m = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html) ?? /<script[^>]+src="([^"]+)"[^>]+type="module"/.exec(html)
  return m ? m[1] : null
}

/** Is the listener mid-sentence somewhere? A reload would lose it. */
function typing(): boolean {
  return [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input[type="text"], input[type="search"], input:not([type])')]
    .some((el) => el.value.trim() !== '')
}

/**
 * Keeps an open tab on the latest deploy. Checked when the page is put away
 * and when it comes back (at most every few minutes). A newer build found
 * while the page is hidden is loaded there and then — the reload happens out
 * of sight, and everything the app holds lives in IndexedDB, so nothing is
 * lost; the route is in the URL. Found while visible, or with words typed
 * into a field, it's offered instead: returns true, and the masthead says so.
 */
export function useNewVersion(): boolean {
  const [newer, setNewer] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD || typeof document === 'undefined') return
    const running = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src')
    if (!running) return
    let last = 0
    let found = false
    const act = () => {
      if (document.visibilityState === 'hidden' && !typing()) window.location.reload()
      else setNewer(true)
    }
    const check = () => {
      if (found) { act(); return }
      if (Date.now() - last < EVERY_MS) return
      last = Date.now()
      fetch(PAGE, { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : ''))
        .then((html) => {
          const latest = entryScript(html)
          if (latest && latest !== running) { found = true; act() }
        })
        .catch(() => {})
    }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [])
  return newer
}
