import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastInput {
  message: string
  tone?: ToastTone
  duration?: number
  /** A single optional action — "Undo", "Retry" — shown as a button inside the
   *  toast. Firing it does NOT auto-dismiss; call `dismiss` yourself if the
   *  action should close it (usually yes, but a "Retry" that fails shouldn't). */
  actionLabel?: string
  onAction?: () => void
}

export interface ToastItem extends ToastInput {
  id: string
}

const DEFAULT_DURATION = 5000

/**
 * A small stack of auto-dismissing toasts — the fourth copy of this shape in
 * the repo (Daily Stoic's global-event emitter, Fit Check's single undo toast,
 * Click Deck's and Lexi5's own inline versions), promoted once a fourth app
 * needed it. App-agnostic on purpose: this hook owns the timers and the list;
 * `ToastStack` renders it; nothing here knows what a "keep" or a "save" is.
 *
 * `push` returns the toast's id, so a caller that wants to dismiss it early
 * (Marquee's keep-undo: the SAME toast that offered "Undo" closes itself the
 * moment the button is pressed) doesn't have to guess it.
 */
export function useToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((toast: ToastInput) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = toast.duration ?? DEFAULT_DURATION
    setToasts((current) => [...current, { ...toast, id }])
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }, [dismiss])

  // Timers are owned by this hook, not by the component the toast happens to
  // render in — a page navigation that unmounts the stack must not leave a
  // setTimeout trying to update state nobody is listening to any more.
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer))
      map.clear()
    }
  }, [])

  return { toasts, push, dismiss }
}
