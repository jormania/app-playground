import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './Toasts.module.css'

export interface Toast {
  id: number
  message: string
  tone: 'quiet' | 'alarm'
  /** An optional single reversal offered alongside the message. Silva only
   *  ever offers one: undoing a Release, which is the one action that takes
   *  something out of view without asking. */
  undo?: () => void
}

export interface ToastControls {
  toasts: Toast[]
  notify: (message: string, options?: { tone?: Toast['tone']; undo?: () => void }) => void
  dismiss: (id: number) => void
}

const QUIET_MS = 4000
const ALARM_MS = 8000

/**
 * The short toast SILVA.md's local-first paragraph calls for: "A failed live
 * write reverts the optimistic change and surfaces a short toast — nothing is
 * silently lost." Deliberately the app's only interruption besides a
 * provocation, and deliberately not a notification centre — a toast says one
 * thing and leaves.
 */
export function useToasts(): ToastControls {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback<ToastControls['notify']>((message, options) => {
    const tone = options?.tone ?? 'quiet'
    const id = (nextId.current += 1)
    setToasts((prev) => [...prev, { id, message, tone, undo: options?.undo }])
    timers.current.set(id, setTimeout(() => dismiss(id), tone === 'alarm' ? ALARM_MS : QUIET_MS))
  }, [dismiss])

  // Every pending timer is cleared on unmount — a fired timer would otherwise
  // call setState on a gone component.
  const timersRef = timers
  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
  }, [timersRef])

  return { toasts, notify, dismiss }
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
          <span className={styles.message}>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.undo?.()
                dismiss(toast.id)
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss"
            onClick={() => dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
