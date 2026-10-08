import { useEffect, useState } from 'react'

/**
 * Hash routes, so a deep link survives a reload and the service worker only
 * ever serves one page:
 *   #/            this week
 *   #/p/<id>      a programme (this week's or an earlier one)
 *   #/threads     themes as threads, and paths still open
 *   #/listening   what has been heard, as a journal
 *   #/notebook    taste, questions, notes to the curator
 *   #/settings
 */
export type Route =
  | { name: 'week' }
  | { name: 'programme'; id: string }
  | { name: 'threads' }
  | { name: 'listening' }
  | { name: 'notebook' }
  | { name: 'settings' }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, arg] = path.split('/')
  switch (head) {
    case 'p': return arg ? { name: 'programme', id: decodeURIComponent(arg) } : { name: 'week' }
    case 'threads': return { name: 'threads' }
    case 'listening': return { name: 'listening' }
    case 'notebook': return { name: 'notebook' }
    case 'settings': return { name: 'settings' }
    default: return { name: 'week' }
  }
}

export function href(r: Route): string {
  return r.name === 'programme' ? `#/p/${encodeURIComponent(r.id)}` : r.name === 'week' ? '#/' : `#/${r.name}`
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
