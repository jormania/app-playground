import { useEffect, useRef } from 'react'
import { CloseIcon } from './icons.jsx'

// Accessible modal shell shared by Settings. Handles the scrim, Esc-to-close, a focus
// trap, focus restore on close, and the dialog ARIA — so each modal only supplies its
// title and body. (Ported from Journal of Delights.)
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    const el = ref.current
    const focusables = () => Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => !n.disabled && n.offsetParent !== null)
    focusables()[0]?.focus()

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      else if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        const i = f.indexOf(document.activeElement)
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus() }
      }
    }
    el.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
