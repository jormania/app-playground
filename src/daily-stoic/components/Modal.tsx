import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** A small, token-styled pop-up. Closes on backdrop click, the × button, or Escape. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'var(--color-scrim)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-sm rounded-lg border border-tertiary bg-background-primary p-5 shadow-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-secondary transition-colors duration-fast hover:bg-background-secondary"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
