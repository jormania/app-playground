import { useEffect, useState } from 'react'
import { readSessionJson, writeSessionJson } from '../../shared/storage'

/**
 * Hash routes, so a deep link survives a reload and the service worker only
 * ever serves one page:
 *   #/                  this week
 *   #/p/<id>            a programme (this week's or an earlier one)
 *   #/listen/<id>/<item> one recording, full screen, while it plays
 *   #/journal           every week so far: what was offered, chosen, heard
 *   #/library           composers, works and recordings met so far
 *   #/threads           themes as threads
 *   #/notebook          taste, questions, notes to the curator
 *   #/concerts          concerts heard live; #/concerts/new to add one, #/concerts/<id> one concert
 *   #/season/<n>        a season in review (twelve weeks)
 *   #/before/<key>      before a concert marked as going: its preparation
 *   #/composer/<name>   a composer's page
 *   #/settings          (#/listening, the old journal address, still works)
 */
export type Route =
  | { name: 'week' }
  | { name: 'programme'; id: string }
  | { name: 'listen'; programmeId: string; itemId: string }
  | { name: 'journal' }
  | { name: 'library' }
  | { name: 'threads' }
  | { name: 'notebook' }
  | { name: 'concerts' }
  | { name: 'concert'; id: string }
  | { name: 'season'; n: number }
  | { name: 'before'; key: string }
  | { name: 'composer'; composer: string }
  | { name: 'settings' }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, rawArg, rawArg2] = path.split('/')
  // A hand-typed or truncated link ("#/composer/100%") must not stop the app: undecodable reads as absent.
  const decode = (x?: string) => { try { return x === undefined ? undefined : decodeURIComponent(x) } catch { return undefined } }
  const arg = decode(rawArg)
  const arg2 = decode(rawArg2)
  switch (head) {
    case 'p': return arg ? { name: 'programme', id: arg } : { name: 'week' }
    case 'listen': return arg && arg2 ? { name: 'listen', programmeId: arg, itemId: arg2 } : { name: 'week' }
    case 'journal':
    case 'listening': return { name: 'journal' }
    case 'library': return { name: 'library' }
    case 'threads': return { name: 'threads' }
    case 'notebook': return { name: 'notebook' }
    case 'concerts': return arg ? { name: 'concert', id: arg } : { name: 'concerts' }
    // A whole number from one up: "1.5" or "1e1" is no season, and was read as one.
    case 'season': return arg && /^\d+$/.test(arg) && Number(arg) >= 1 ? { name: 'season', n: Number(arg) } : { name: 'journal' }
    case 'before': return arg ? { name: 'before', key: arg } : { name: 'week' }
    case 'composer': return arg ? { name: 'composer', composer: arg } : { name: 'library' }
    case 'settings': return { name: 'settings' }
    default: return { name: 'week' }
  }
}

export function href(r: Route): string {
  if (r.name === 'programme') return `#/p/${encodeURIComponent(r.id)}`
  if (r.name === 'concert') return `#/concerts/${encodeURIComponent(r.id)}`
  if (r.name === 'season') return `#/season/${r.n}`
  if (r.name === 'before') return `#/before/${encodeURIComponent(r.key)}`
  if (r.name === 'composer') return `#/composer/${encodeURIComponent(r.composer)}`
  if (r.name === 'listen') return `#/listen/${encodeURIComponent(r.programmeId)}/${encodeURIComponent(r.itemId)}`
  return r.name === 'week' ? '#/' : `#/${r.name}`
}

export function go(r: Route): void {
  window.location.hash = href(r)
}

/**
 * Where you were: the pages just left, each with how far down it was read.
 * Going back to one of them — by its own link ("← the programme") or by the
 * phone's Back — lands where you were on it; a page opened afresh starts at
 * the top. Going back to a page drops everything visited after it, so the
 * trail stays the way you came. Kept for the tab's life (sessionStorage),
 * so a reload on the listening view still finds the programme's place.
 */
export type Trail = { hash: string; y: number }[]
const TRAIL_KEY = 'long-listen:trail'
const TRAIL_MAX = 20

const key = (h: string) => h.replace(/^#\/?/, '') || '/'

/** The trail after leaving `from` (read down to `y`) for `to`, and where `to` should open. */
export function stepTrail(trail: Trail, from: string, y: number, to: string): { trail: Trail; y: number } {
  const left = [...trail.filter((p) => key(p.hash) !== key(from)), { hash: from, y: Math.max(0, Math.round(y)) }]
  const at = left.findIndex((p) => key(p.hash) === key(to))
  if (at < 0) return { trail: left.slice(-TRAIL_MAX), y: 0 }
  return { trail: left.slice(0, at), y: left[at].y }
}

/**
 * Of the addresses that show the same page, the one last left in `trail`:
 * this week's programme is at "#/" when opened from This week and at
 * "#/p/<id>" from anywhere else, and only the one you came from holds your place.
 */
export function cameFrom(trail: Trail, candidates: string[]): string | undefined {
  const wanted = new Set(candidates.map(key))
  for (let i = trail.length - 1; i >= 0; i--) if (wanted.has(key(trail[i].hash))) return trail[i].hash
  return undefined
}

function readTrail(): Trail {
  const kept = readSessionJson<unknown>(TRAIL_KEY, [])
  return Array.isArray(kept) ? kept.filter((p): p is Trail[number] => typeof p?.hash === 'string' && typeof p?.y === 'number') : []
}

/** The way back to a programme: by the address it was last read at, so the place there holds. */
export function programmeBackHref(id: string): string {
  const own = href({ name: 'programme', id })
  return cameFrom(readTrail(), ['#/', own]) ?? own
}

/**
 * Scroll to `y` once the page is long enough to get there: a screen draws from
 * the store a moment after the route changes, so the place is tried each frame
 * for a few seconds — and given up the moment the listener scrolls or taps.
 */
function restoreScroll(y: number): void {
  if (y <= 0) { window.scrollTo({ top: 0 }); return }
  const until = Date.now() + 3000
  let stopped = false
  const stop = () => { stopped = true }
  const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const
  for (const e of events) window.addEventListener(e, stop, { passive: true, once: true })
  const done = () => { for (const e of events) window.removeEventListener(e, stop) }
  const tick = () => {
    if (stopped) { done(); return }
    const reach = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: Math.min(y, Math.max(0, reach)) })
    if (reach >= y || Date.now() > until) { done(); return }
    requestAnimationFrame(tick)
  }
  window.scrollTo({ top: 0 })
  requestAnimationFrame(tick)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    // The app keeps the places itself: the browser's own restoring would fight it on Back.
    try { history.scrollRestoration = 'manual' } catch { /* not supported */ }
    // The position is read as the page is left, before the next screen draws.
    let here = window.location.hash
    const on = () => {
      const to = window.location.hash
      const next = stepTrail(readTrail(), here, window.scrollY, to)
      writeSessionJson(TRAIL_KEY, next.trail)
      here = to
      setRoute(parseRoute(to))
      restoreScroll(next.y)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
