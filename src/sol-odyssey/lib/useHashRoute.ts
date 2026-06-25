import { useEffect, useState } from 'react'

/** Minimal hash router: `#/`, `#/charter`, `#/settings`. (Full react-router arrives in M3 when
 *  Today/Tracker/Weekly each need a route.) */
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = (to: string) => {
    if (read() === to) setRoute(to)
    else window.location.hash = to
  }
  return { route, navigate }
}
