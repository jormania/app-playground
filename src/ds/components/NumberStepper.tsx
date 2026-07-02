import { forwardRef, useId, type ChangeEvent } from 'react'
import { cx } from '../lib/cx'
import { Button } from './Button'
import styles from './NumberStepper.module.css'

export interface NumberStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  hint?: string
  className?: string
}

function clamp(value: number, min?: number, max?: number) {
  let result = value
  if (min != null) result = Math.max(min, result)
  if (max != null) result = Math.min(max, result)
  return result
}

/** A labelled numeric control: [−] a big centred value [+]. The native
 *  spinner is hidden — the ± buttons (DS Buttons themselves) are the
 *  affordance, but the input stays real, so typing and select-all still
 *  work. Sits at the same 44px height as Field/Button so it lines up. */
export const NumberStepper = forwardRef<HTMLInputElement, NumberStepperProps>(
  ({ label, value, onChange, min, max, step = 1, hint, className }, ref) => {
    const autoId = useId()
    const hintId = hint ? `${autoId}-hint` : undefined
    const atMin = min != null && value <= min
    const atMax = max != null && value >= max

    function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
      const parsed = Number(e.target.value)
      if (Number.isNaN(parsed)) return
      onChange(clamp(parsed, min, max))
    }

    return (
      <div className={cx(styles.stepper, className)}>
        <label htmlFor={autoId} className={styles.label}>
          {label}
        </label>
        <div className={styles.control}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Decrease"
            disabled={atMin}
            onClick={() => onChange(clamp(value - step, min, max))}
          >
            −
          </Button>
          <input
            ref={ref}
            id={autoId}
            type="number"
            inputMode="numeric"
            className={styles.input}
            value={value}
            min={min}
            max={max}
            step={step}
            aria-describedby={hintId}
            onChange={handleInputChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Increase"
            disabled={atMax}
            onClick={() => onChange(clamp(value + step, min, max))}
          >
            +
          </Button>
        </div>
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
    )
  },
)
NumberStepper.displayName = 'NumberStepper'
