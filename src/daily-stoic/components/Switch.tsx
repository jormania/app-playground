import { useId } from 'react'
import { cn } from '../lib/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  description?: string
}

/** A token-styled on/off switch (role="switch"), keyboard- and screen-reader-accessible. */
export function Switch({ checked, onCheckedChange, label, description }: SwitchProps) {
  const id = useId()
  const descId = description ? `${id}-desc` : undefined
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="font-sans text-sm font-medium text-text-primary">
          {label}
        </label>
        {description && (
          <p id={descId} className="font-sans text-sm text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-pill border transition-colors duration-fast',
          'focus-visible:outline-none',
          checked
            ? 'border-accent bg-accent'
            : 'border-secondary bg-background-tertiary',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-pill bg-accent-contrast transition-all duration-fast',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}
