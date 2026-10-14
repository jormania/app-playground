import { useEffect, useState } from 'react'

/**
 * Hash routes, so a deep link survives a reload and the service worker only
 * ever serves one page:
 *   #/                  this week
 *   #/p/<id>            a programme (this week's or an earlier one)
 *   #/listen/<id>/<item> one recording, full screen, while it plays
 *   #/journal           every week so far: what was offered, chosen, heard
 *   #/library           composers, works and recordings met so far
 *   #/threads           themes as threads, and paths still open
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

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
