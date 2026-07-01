import { forwardRef, useId } from 'react'
import { cx } from '../lib/cx'
import styles from './Field.module.css'

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  required?: boolean
}

/** A labelled text input. Shows a hint or, when present, an error message (which
 *  takes precedence and marks the input invalid). Inputs stay ≥16px so mobile
 *  Safari never auto-zooms on focus. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, required, id, className, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const hintId = hint ? `${inputId}-hint` : undefined
    const errorId = error ? `${inputId}-error` : undefined
    return (
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden>
              {' '}
              *
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          className={cx(styles.input, error && styles.inputError, className)}
          {...props}
        />
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
    )
  },
)
Field.displayName = 'Field'
