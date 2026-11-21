import { useEffect, useState } from 'react'

/**
 * Screens live in the URL hash, so Android's back gesture walks back through
 * them and a session can be linked to directly. Same approach as KeyPath's
 * router; no router library for nine screens.
 */
export type Route =
  | { name: 'discover' }
  | { name: 'explore' }
  | { name: 'session'; id: string }
  | { name: 'surprise' }
  | { name: 'practice' }
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'series' }
  | { name: 'seriesDetail'; id: string }
  | { name: 'settings' }
  | { name: 'editor'; id?: string }

export type Tab = 'discover' | 'explore' | 'series' | 'practice'

const decode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function parseRoute(hash: string): Route {
  const [head, arg, sub] = hash.replace(/^#\/?/, '').split('/')
  switch (head) {
    case 'explore':
    case 'surprise':
    case 'practice':
      return { name: head }
    case 'session':
      return arg ? { name: 'session', id: decode(arg) } : { name: 'explore' }
    case 'collections':
      return arg ? { name: 'collection', id: decode(arg) } : { name: 'collections' }
    case 'series':
      return arg ? { name: 'seriesDetail', id: decode(arg) } : { name: 'series' }
    case 'settings':
      if (arg === 'session') return sub && sub !== 'new' ? { name: 'editor', id: decode(sub) } : { name: 'editor' }
      return { name: 'settings' }
    default:
      return { name: 'discover' }
  }
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'discover': return '#/'
    case 'session': return `#/session/${encodeURIComponent(route.id)}`
    case 'collection': return `#/collections/${encodeURIComponent(route.id)}`
    case 'seriesDetail': return `#/series/${encodeURIComponent(route.id)}`
    case 'editor': return `#/settings/session/${route.id ? encodeURIComponent(route.id) : 'new'}`
    default: return `#/${route.name}`
  }
}

export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'discover': case 'explore': case 'series': case 'practice': return route.name
    // Surprise Me lives on Today; collections are part of the library.
    case 'surprise': return 'discover'
    case 'collections': case 'collection': return 'explore'
    case 'session': return null
    case 'seriesDetail': return 'series'
    default: return null
  }
}

/** `replace` swaps the current history entry, so Back skips a screen you were done with (an editor after saving). */
export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  if (opts.replace) {
    window.location.replace(hrefOf(route))
  } else {
    window.location.hash = hrefOf(route)
  }
}

/**
 * Scroll offsets per history entry. Each entry is stamped with a number the
 * first time it is seen, so the router can tell the two ways of arriving:
 * Back or Forward lands on a stamped entry and returns to where you left it;
 * anything else (a link, a tab, a "Practise for" card, a replace after saving)
 * is a new, unstamped entry and starts at the top. Keyed by entry rather than
 * by hash, so two visits to the same screen keep their own place.
 */
const scrollMemory = new Map<number, number>()
let nextEntry = 0

/** The current entry's stamp, stamping it if it is new. */
function stampEntry(): { id: number; fresh: boolean } {
  const st = window.history.state as { sfEntry?: number } | null
  if (st && typeof st.sfEntry === 'number') {
    nextEntry = Math.max(nextEntry, st.sfEntry + 1)
    return { id: st.sfEntry, fresh: false }
  }
  const id = nextEntry++
  try {
    window.history.replaceState({ ...(st ?? {}), sfEntry: id }, '')
  } catch {
    // Some embedded browsers refuse replaceState; the screen just starts at the top.
  }
  return { id, fresh: true }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    let current = stampEntry().id
    const onScroll = () => scrollMemory.set(current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    const on = () => {
      const entry = stampEntry()
      current = entry.id
      setRoute(parseRoute(window.location.hash))
      const y = entry.fresh ? 0 : scrollMemory.get(current) ?? 0
      // Twice: once the new screen has rendered, and once it has laid out.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })))
    }
    window.addEventListener('hashchange', on)
    return () => {
      window.removeEventListener('hashchange', on)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return route
}
