import { forwardRef, useId } from 'react'
import { cn } from '../lib/cn'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  required?: boolean
}

/** A labelled multi-line input for the charter's rich-text fields, token-styled. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, required, id, className, rows = 3, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const hintId = hint ? `${inputId}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="font-sans text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-accent" aria-hidden> *</span>}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-describedby={hintId}
          className={cn(
            'rounded-md border border-secondary bg-background-primary px-3 py-2 text-base text-text-primary',
            'placeholder:text-text-secondary/60 transition-colors duration-fast',
            'focus-visible:border-accent focus-visible:outline-none resize-y',
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
Textarea.displayName = 'Textarea'
