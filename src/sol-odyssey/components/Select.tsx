import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/cn'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

/** A token-styled native <select> — accessible by default, no extra dependency. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, options, placeholder, id, className, ...props }, ref) => {
    const autoId = useId()
    const selectId = id ?? autoId
    const hintId = hint ? `${selectId}-hint` : undefined
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="font-sans text-sm font-medium text-text-primary">
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-describedby={hintId}
            className={cn(
              'h-11 w-full appearance-none rounded-md border border-secondary bg-background-primary px-3 pr-9 text-base text-text-primary',
              'transition-colors duration-fast focus-visible:border-accent focus-visible:outline-none',
              className,
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
        </div>
        {hint && (
          <p id={hintId} className="font-sans text-sm text-text-secondary">
            {hint}
          </p>
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'
