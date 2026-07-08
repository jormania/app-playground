import { useEffect } from 'react'
import { CloseIcon } from './icons.jsx'

// Full-size view for an item's photo — deliberately minimal, unlike the shared Modal (no
// title bar, no focus trap): just the picture, as taken, over a scrim. Ported from Journal
// of Delights' Lightbox.
export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt || 'Photo'}>
      <button className="icon-btn lightbox-close" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>
      <img className="lightbox-img" src={src} alt={alt || ''} onClick={e => e.stopPropagation()} />
    </div>
  )
}
