import { useState } from 'react'
import { Image as PosterPlaceholderIcon } from 'lucide-react'

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
  const [failed, setFailed] = useState(false)
  const hasImage = Boolean(src) && !failed
  return (
    <div className={`${className}${hasImage ? '' : ` ${className}--placeholder`}`}>
      {hasImage ? (
        <img src={src} alt="" aria-hidden="true" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <PosterPlaceholderIcon aria-hidden="true" />
      )}
    </div>
  )
}
