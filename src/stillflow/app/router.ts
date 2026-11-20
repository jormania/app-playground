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

export type Tab = 'discover' | 'explore' | 'surprise' | 'series' | 'practice' | 'collections'

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
    case 'discover': case 'explore': case 'surprise': case 'series': case 'practice': case 'collections': return route.name
    case 'session': return null
    case 'collection': return 'collections'
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

/** Scroll offsets per hash, so Back to a long list lands where you left it. */
const scrollMemory = new Map<string, number>()

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    let current = window.location.hash
    const onScroll = () => scrollMemory.set(current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    const on = () => {
      current = window.location.hash
      setRoute(parseRoute(current))
      const y = scrollMemory.get(current) ?? 0
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
