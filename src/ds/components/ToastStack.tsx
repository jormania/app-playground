import { cx } from '../lib/cx'
import type { ToastItem } from './useToastStack'
import styles from './ToastStack.module.css'

export interface ToastStackProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

/** Renders whatever `useToastStack` is holding, bottom-of-screen, newest last.
 *  `role="status"`/`aria-live="polite"` rather than `alert`: a toast is an
 *  ambient confirmation ("kept", "removed"), not something that should
 *  interrupt a screen reader mid-sentence the way a form error does. */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx(styles.toast, toast.tone && styles[toast.tone])}>
          <span className={styles.message}>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className={styles.action}
              onClick={() => { toast.onAction?.(); onDismiss(toast.id) }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
