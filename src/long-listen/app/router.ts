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
  | { name: 'settings' }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, arg, arg2] = path.split('/')
  switch (head) {
    case 'p': return arg ? { name: 'programme', id: decodeURIComponent(arg) } : { name: 'week' }
    case 'listen': return arg && arg2 ? { name: 'listen', programmeId: decodeURIComponent(arg), itemId: decodeURIComponent(arg2) } : { name: 'week' }
    case 'journal':
    case 'listening': return { name: 'journal' }
    case 'library': return { name: 'library' }
    case 'threads': return { name: 'threads' }
    case 'notebook': return { name: 'notebook' }
    case 'concerts': return arg ? { name: 'concert', id: decodeURIComponent(arg) } : { name: 'concerts' }
    case 'settings': return { name: 'settings' }
    default: return { name: 'week' }
  }
}

export function href(r: Route): string {
  if (r.name === 'programme') return `#/p/${encodeURIComponent(r.id)}`
  if (r.name === 'concert') return `#/concerts/${encodeURIComponent(r.id)}`
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
