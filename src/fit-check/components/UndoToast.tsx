import { useEffect, useState } from 'react'

interface Props {
  message: string
  onUndo: () => void
  duration?: number
}

/**
 * The five-second grace period on a delete. Styling lives in `index.css` with
 * the rest of the app's — it was ~30 lines of inline `style={{…}}` here, the
 * same inconsistency R1 cleaned out of the details modal.
 */
export default function UndoToast({ message, onUndo, duration = 5000 }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) return null

  return (
    <div className="fc-undo-toast" role="alert">
      <span className="fc-undo-message">{message}</span>
      <button
        type="button"
        className="fc-undo-action"
        onClick={() => {
          setVisible(false)
          onUndo()
        }}
      >
        Undo
      </button>
    </div>
  )
}
