import { forwardRef, useId } from 'react'
import { cn } from '../lib/cn'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  required?: boolean
}

/** A labelled text input, fully token-styled. Inputs stay ≥16px so mobile Safari
 *  never auto-zooms on focus. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, required, id, className, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const hintId = hint ? `${inputId}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="font-sans text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-accent" aria-hidden> *</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-describedby={hintId}
          className={cn(
            'h-11 rounded-md border border-secondary bg-background-primary px-3 text-base text-text-primary',
            'placeholder:text-text-secondary/60 transition-colors duration-fast',
            'focus-visible:border-accent focus-visible:outline-none',
            className,
          )}
          {...props}
        />
        {hint && (
          <p id={hintId} className="font-sans text-sm text-text-secondary">
            {hint}
          </p>
        )}
      </div>
    )
  },
)
Field.displayName = 'Field'
