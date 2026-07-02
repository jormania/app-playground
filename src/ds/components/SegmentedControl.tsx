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
  className?: string
}

/** A compact multi-option toggle: a track holding N buttons, one active. */
export function SegmentedControl({ options, value, onChange, size = 'md', className }: SegmentedControlProps) {
  return (
    <div className={cx(styles.track, styles[size], className)} role="radiogroup">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
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
