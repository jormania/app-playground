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
 * @param {number} dwellMs how long each message stays on screen
 * @returns {{ toast: string|null, showToast: (msg: string) => void }}
 */
export function useToastQueue(dwellMs = DEFAULT_DWELL_MS) {
  const [toast, setToast] = useState(null)
  const [queue, setQueue] = useState([])

  const showToast = useCallback((msg) => {
    setToast(prevToast => {
      if (prevToast === null) return msg
      setQueue(prevQueue => {
        if (msg === prevToast || msg === prevQueue[prevQueue.length - 1]) return prevQueue
        return [...prevQueue, msg]
      })
      return prevToast
    })
  }, [])

  // Depends on `toast` alone. Queuing a message behind the current one changes `queue`
  // but not `toast`, and if this effect watched both, every queue push would re-arm the
  // showing toast's timer and hold it on screen well past its dwell.
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), dwellMs)
    return () => clearTimeout(timer)
  }, [toast, dwellMs])

  useEffect(() => {
    if (toast || queue.length === 0) return
    setToast(queue[0])
    setQueue(prev => prev.slice(1))
  }, [toast, queue])

  return { toast, showToast }
}
