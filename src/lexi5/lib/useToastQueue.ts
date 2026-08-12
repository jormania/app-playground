import { useState, useEffect, useCallback } from 'react'

const DEFAULT_DWELL_MS = 2000

/**
 * A single-slot toast with a queue behind it.
 *
 * Messages queue rather than overwrite: a toast fired while another is showing waits its
 * turn instead of clobbering it. Immediate repeats of the *same* message are deduped
 * against both what's showing and the tail of the queue, so mashing Enter on an invalid
 * guess doesn't build up a run of identical toasts.
 *
 * A message may carry one action (used for Undo on destructive changes). Actions extend
 * the dwell, since a two-second window to notice and hit Undo isn't a real offer.
 *
 * @param dwellMs how long a plain message stays on screen
 */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  message: string
  action?: ToastAction
}

export function useToastQueue(dwellMs = DEFAULT_DWELL_MS): {
  toast: Toast | null
  showToast: (message: string, action?: ToastAction) => void
} {
  const [toast, setToast] = useState<Toast | null>(null)
  const [queue, setQueue] = useState<Toast[]>([])

  const showToast = useCallback((message: string, action?: ToastAction) => {
    const next = { message, action }
    setToast(prevToast => {
      if (prevToast === null) return next
      setQueue(prevQueue => {
        const last = prevQueue[prevQueue.length - 1]
        // Dedupe on the message only; an actionable toast is never dropped as a repeat.
        if (!action && (message === prevToast.message || message === last?.message)) return prevQueue
        return [...prevQueue, next]
      })
      return prevToast
    })
  }, [])

  // Depends on `toast` alone. Queuing a message behind the current one changes `queue`
  // but not `toast`, and if this effect watched both, every queue push would re-arm the
  // showing toast's timer and hold it on screen well past its dwell.
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), toast.action ? dwellMs * 4 : dwellMs)
    return () => clearTimeout(timer)
  }, [toast, dwellMs])

  useEffect(() => {
    if (toast || queue.length === 0) return
    setToast(queue[0])
    setQueue(prev => prev.slice(1))
  }, [toast, queue])

  return { toast, showToast }
}
