import { useEffect, useState } from 'react'

/** Minimal hash router for Daily Stoic's screens (`#/`, `#/settings`, `#/stats`,
 *  `#/digest`, `#/dichotomy`, `#/passions`, `#/amorfati`, `#/memento`,
 *  `#/enchiridion`). A notification tap can also post a target route in via the
 *  service-worker message below. */
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    // The reminders service worker can't set an open tab's location.hash directly (no window
    // access from a worker), so a notification tap posts the target route instead.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'daily-stoic:navigate' && typeof e.data.hash === 'string') {
        window.location.hash = e.data.hash
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('hashchange', onChange)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  const navigate = (to: string) => {
    if (read() === to) setRoute(to)
    else window.location.hash = to
  }
  return { route, navigate }
}
