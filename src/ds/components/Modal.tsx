import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import styles from './Modal.module.css'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Dialogs.tsx ships nested dialogs (a ConfirmModal rendered inside an already-open
// Modal) as a first-class pattern, so more than one Modal is routinely open at once.
// Each listens for Escape on `document`, and without a shared notion of "which is on
// top" a single Escape fired every listener and tore down the whole stack — backing out
// of a confirmation also discarded the panel behind it.
//
// "Which is on top" is nesting depth, tracked through context. Neither DOM order nor
// effect order can stand in for it: React commits portals bottom-up (a nested dialog
// lands in <body> *before* its parent) and runs child effects first, so both orderings
// report a nested modal as the lower one. Depth also drives z-index below, since the
// same bottom-up commit meant a nested dialog painted behind its parent at equal
// z-index.
const ModalDepthContext = createContext(0)

// Depth of every currently-open modal. The deepest is the one in front.
const openDepths = new Map<symbol, number>()

function isTopmost(token: symbol) {
  const mine = openDepths.get(token)
  if (mine === undefined) return false
  for (const depth of openDepths.values()) {
    if (depth > mine) return false
  }
  return true
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

/** A token-styled dialog. Closes on the × button, backdrop click, or Escape.
 *  While open it traps focus inside the dialog and restores focus to the
 *  previously-focused element on close. */
export function Modal({ open, onClose, title, children, className, style }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const parentDepth = useContext(ModalDepthContext)
  const depth = parentDepth + 1
  // Stable identity for this instance in the open-modal registry below.
  const [token] = useState(() => Symbol('modal'))
  const [isMounted, setIsMounted] = useState(open)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  // Opening is handled during render, not from an effect. Done in an effect it
  // left one commit where `open` was true but this still returned null — so a
  // parent that opens the dialog and then reaches into its content from an
  // effect keyed on that same flag ran in exactly that window and found
  // nothing there. It cost the focus trap below (dynamically opened dialogs
  // never received focus) and later Cabinet's QR canvas, which drew into a
  // still-null ref and failed silently. Adjusting state during render is
  // React's supported answer: it re-runs this component immediately, before
  // committing anything, so the children exist on the very commit `open` flips
  // true. The condition converges on the next pass, which is what makes it
  // legal — and isAnimatingOut is caught too, so reopening mid-close-animation
  // cancels the fade rather than fading out from under itself.
  if (open && (!isMounted || isAnimatingOut)) {
    setIsMounted(true)
    setIsAnimatingOut(false)
  }

  // Closing still has to wait: the node must outlive `open` for the length of
  // the close animation, which is the reason isMounted exists at all.
  useEffect(() => {
    if (open || !isMounted) return
    setIsAnimatingOut(true)
    const timer = setTimeout(() => {
      setIsMounted(false)
      setIsAnimatingOut(false)
    }, 250) // Match CSS animation duration
    return () => clearTimeout(timer)
  }, [open, isMounted])

  // Held in a ref so the focus effect below can depend on `open` alone. Consumers
  // routinely pass an inline arrow, which is a new identity on every parent render — with
  // onClose in the dependency array the effect tore down and re-ran on each of those,
  // restoring and re-grabbing focus, which yanked the caret out of whatever field the
  // user was typing in every time the parent re-rendered.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // isMounted stays in the deps alongside open: the portal — and so dialogRef — exists
  // only while it's true, and it outlives `open` for the close animation. Since opening
  // now happens during render (above), both are true on the same commit, so this runs
  // once per open rather than missing the first pass as it used to.
  useEffect(() => {
    if (!open || !isMounted) return
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    openDepths.set(token, depth)

    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])

    // Move focus into the dialog (first focusable, else the dialog itself).
    ;(focusables()[0] ?? dialog)?.focus()

    const onKey = (e: KeyboardEvent) => {
      // A nested dialog owns the keyboard while it's open; everything below it waits.
      if (!isTopmost(token)) return
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        // Nothing to tab to — keep focus on the dialog.
        e.preventDefault()
        dialog?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openDepths.delete(token)
      previouslyFocused?.focus?.()
    }
  }, [open, isMounted, token, depth])

  if (!isMounted) return null

  // Portalled straight to <body>: a CSS `transform` (or `filter`/`will-change`)
  // on ANY ancestor — e.g. Cabinet's AppTile, whose .tile gets a hover
  // transform — turns that ancestor into position:fixed's containing block
  // instead of the viewport, trapping the overlay inside that element's own
  // box rather than centering it on screen. Rendering outside the React tree
  // this way sidesteps that regardless of where <Modal> gets used from.
  return createPortal(
    <div
      className={cx(styles.overlay, isAnimatingOut && styles.closing)}
      style={{ zIndex: 50 + depth }}
    >
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(styles.dialog, className)}
        style={style}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className={styles.close}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          <ModalDepthContext.Provider value={depth}>{children}</ModalDepthContext.Provider>
        </div>
      </div>
    </div>,
    document.body,
  )
}
