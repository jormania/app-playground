import { useEffect, useState } from 'react'
import type { Door } from './log'

/**
 * Screens live in the URL hash, so the phone's back button walks back through
 * them the way anyone expects — no router library needed for six screens.
 */
export type Route =
  | { name: 'start' }
  | { name: 'who' }
  | { name: 'home' }
  | { name: 'door'; door: Door }
  | { name: 'settings' }
  | { name: 'diagnostics' }
  | { name: 'songImport' }
  | { name: 'play'; songId: string }
  | { name: 'connect' }
  | { name: 'journeyStep'; step: string }
  /** Studio opened from a song ("Make it yours"); from Home it's the studio door. */
  | { name: 'studio'; songId: string }

const DOORS: readonly Door[] = ['songs', 'journey', 'challenges', 'studio']

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [head, arg] = path.split('/')
  switch (head) {
    case 'who':
    case 'home':
    case 'settings':
    case 'diagnostics':
    case 'connect':
      return { name: head }
    case 'songs':
      return arg === 'import' ? { name: 'songImport' } : { name: 'door', door: 'songs' }
    case 'studio':
      return arg ? { name: 'studio', songId: decodeURIComponent(arg) } : { name: 'door', door: 'studio' }
    case 'journey':
      return arg ? { name: 'journeyStep', step: decodeURIComponent(arg) } : { name: 'door', door: 'journey' }
    case 'play':
      return arg ? { name: 'play', songId: decodeURIComponent(arg) } : { name: 'door', door: 'songs' }
    case 'door':
      return DOORS.includes(arg as Door) ? { name: 'door', door: arg as Door } : { name: 'home' }
    default:
      return { name: 'start' }
  }
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'door':
      return `#/door/${route.door}`
    case 'start':
      return '#/'
    case 'songImport':
      return '#/songs/import'
    case 'play':
      return `#/play/${encodeURIComponent(route.songId)}`
    case 'studio':
      return `#/studio/${encodeURIComponent(route.songId)}`
    case 'journeyStep':
      return `#/journey/${encodeURIComponent(route.step)}`
    default:
      return `#/${route.name}`
  }
}

export function navigate(route: Route, { replace = false } = {}): void {
  const href = hrefOf(route)
  if (replace) history.replaceState(null, '', href)
  else history.pushState(null, '', href)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  return route
}
