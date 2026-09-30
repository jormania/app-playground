import { useState } from 'react'

/** How many times the hero asks for a picture before it stops asking.
 *
 *  Three, because of what a Radar source can answer with. modernism.ro —
 *  LiteSpeed behind Cloudflare, like cndb.ro before it — returns a 12KB
 *  "One moment, please…" interstitial in place of the image bytes: HTTP 200,
 *  `content-type: text/html`, at random. Measured on one Kulterra poster,
 *  five requests gave two interstitials and three pictures; an edge-cached
 *  URL never failed at all, so which you get depends on the cache, not on
 *  anything the browser sends. A browser cannot decode HTML as a picture, so
 *  `onError` fires on a URL that is perfectly good.
 *
 *  At that rate one attempt shows about three pictures in five and three
 *  attempts about nineteen in twenty. Past three the gain is small and each
 *  extra try is another request to a host already saying no. */
const MAX_ATTEMPTS = 3

/**
 * The URL to ask for on a given attempt.
 *
 * **Attempt 0 is the URL untouched**, so a picture that loads first time — every
 * Eventbook and curatorial.ro cover does — is never rewritten and stays
 * cacheable. A retry has to bust the cache or it is not a retry: the browser
 * holds the failed response for this exact URL and would re-serve it without
 * asking anyone. Appended to any existing query rather than assuming there is
 * none, because some sources' images already carry sizing parameters.
 */
export function heroUrl(src, attempt) {
  if (!src || attempt <= 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}rb-retry=${attempt}`
}

/**
 * The picture at the top of a detail view, or nothing at all.
 *
 * Nothing, rather than Marquee's placeholder outline: there the slot has to hold
 * its shape so every list row's title starts from the same left edge, but a
 * detail view has one hero and nothing to line it up with. An empty 16∶9 box of
 * `--color-surface-2` says only "a picture failed", which the reader can neither
 * use nor act on, and it pushes the event's name a third of a screen down to say
 * it. Without the picture the name is simply first, which is where it belongs.
 *
 * `alt=""` and `aria-hidden` because the image is decorative — a Radar row's
 * `Image` is whatever the source happened to publish beside the article, never a
 * description of the event. The words below it carry the meaning.
 */
export function Hero({ src }) {
  const [tries, setTries] = useState({ src, attempt: 0 })

  // The attempt count belongs to ONE event. `EventDetail` is mounted unkeyed
  // (App.jsx), so React keeps the same instance alive when you close one event
  // and open another, and without this reset an event whose picture had failed
  // three times would hand that exhaustion to the next one — a hero that no
  // amount of reopening would bring back. Adjusting state during render is
  // React's own answer to a prop-derived reset; an effect would paint the
  // previous event's picture first.
  if (tries.src !== src) setTries({ src, attempt: 0 })
  const attempt = tries.src === src ? tries.attempt : 0

  if (!src || attempt >= MAX_ATTEMPTS) return null
  return (
    <img
      className="detailHero"
      src={heroUrl(src, attempt)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setTries((t) => (t.src === src ? { src, attempt: t.attempt + 1 } : t))}
    />
  )
}
