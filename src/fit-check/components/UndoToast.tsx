import { useEffect, useState } from 'react'

interface Props {
  message: string
  onUndo: () => void
  duration?: number
}

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
    <div className="fc-undo-toast" role="alert" style={{
      position: 'fixed',
      bottom: 'calc(var(--fc-nav-height) + env(safe-area-inset-bottom, 0px) + 16px)',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--color-ink)',
      color: 'var(--color-bg)',
      padding: '12px 16px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 100,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'fc-fade-in 220ms ease-out',
      fontSize: '0.9375rem',
      maxWidth: 'calc(100vw - 32px)',
      width: 'max-content'
    }}>
      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{message}</span>
      <button 
        type="button" 
        onClick={() => {
          setVisible(false)
          onUndo()
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-accent)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          fontSize: 'inherit',
          whiteSpace: 'nowrap'
        }}
      >
        Undo
      </button>
    </div>
  )
}
