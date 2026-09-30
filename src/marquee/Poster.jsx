import { useState } from 'react'
import { Image as PosterPlaceholderIcon } from 'lucide-react'

/** How many times a poster is asked for before the slot gives up.
 *
 *  Three, because of what cndb.ro does (§9.92): it answers an image request
 *  with a 12KB "One moment, please…" bot-check page — at HTTP 200, with
 *  `content-type: text/html` — roughly half the time, at random. A browser
 *  cannot decode that as a picture, so `onError` fires and the card falls back
 *  to the outline even though the URL is perfectly good. Measured over ten
 *  requests for one poster: four images, six interstitials, with neither the
 *  referrer nor the user agent making any difference.
 *
 *  At that rate one attempt shows about half the posters and three show about
 *  seven in eight. Beyond three the returns are small and every extra try is
 *  another request to a site that is already saying no. */
const MAX_ATTEMPTS = 3

/**
 * The URL to ask for on a given attempt.
 *
 * **Attempt 0 is the URL untouched** — a poster that loads first time, which is
 * every other venue, is never rewritten and stays cacheable.
 *
 * A retry has to bust the cache or it is not a retry at all: the browser
 * already holds the failed response for this exact URL and would re-serve it
 * without a request, so the second attempt would fail instantly and for free.
 * Appending to the existing query rather than assuming there is none, because
 * some venues' posters are already parameterised (imgcdn's sizing URLs).
 */
export function posterUrl(src, attempt) {
  if (!src || attempt <= 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}mq-retry=${attempt}`
}

/** A production's poster — or the same-sized outline standing in for one.
 *  Readers vary in whether they return a cover (Excelsior's markup carries
 *  none; Eventbook, Expirat, Oveit, TNB and mystage all do), and a real one
 *  can still 404. Either way the slot always renders: a card with no cover
 *  keeping the same geometry as one with a photo is what lets the title
 *  column start from the same left edge, entry after entry, rather than
 *  drifting over to fill a poster-shaped gap that isn't there.
 *
 *  `className` is the frame's own class — `Programme.jsx`'s list rows and
 *  `PosterGrid.jsx`'s tiles each size and shape it differently in CSS, so
 *  this stays one component rather than two copies of the same fallback
 *  logic. */
export function Poster({ src, className = 'prod__poster' }) {
  const [tries, setTries] = useState({ src, attempt: 0 })

  // The attempt count belongs to ONE poster, so it resets when the slot is
  // reused for another. React keeps a component instance alive across a
  // re-ordered list, so without this a production that had exhausted its
  // retries would hand its exhaustion to whichever production took its place —
  // a blank poster that no amount of reloading would bring back. Adjusting
  // state during render is React's own answer to this; an effect would paint
  // the wrong poster first.
  if (tries.src !== src) setTries({ src, attempt: 0 })
  const attempt = tries.src === src ? tries.attempt : 0

  const hasImage = Boolean(src) && attempt < MAX_ATTEMPTS
  return (
    <div className={`${className}${hasImage ? '' : ` ${className}--placeholder`}`}>
      {hasImage ? (
        <img
          src={posterUrl(src, attempt)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => setTries((t) => (t.src === src ? { src, attempt: t.attempt + 1 } : t))}
        />
      ) : (
        <PosterPlaceholderIcon aria-hidden="true" />
      )}
    </div>
  )
}
