import { cx } from '../lib/cx'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption {
  value: string
  label: string
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/** A compact multi-option toggle: a track holding N buttons, one active. */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cx(styles.track, styles[size], disabled && styles.disabled, className)}
      role="radiogroup"
      aria-disabled={disabled || undefined}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={cx(styles.option, active && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
