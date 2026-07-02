import { forwardRef } from 'react'
import { cx } from '../lib/cx'
import styles from './IconButton.module.css'

export type IconButtonSize = 'sm' | 'md'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize
  /** Filled/active state — e.g. a toggle that's currently on. */
  selected?: boolean
}

/** A square, icon-only button with real weight — a soft filled surface, border,
 *  hover lift, and a clear selected state. For inline actions (reorder, step)
 *  and top-bar toggles where a text button would read as too airy. Requires an
 *  `aria-label` since it has no text. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', selected = false, type = 'button', className, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected || undefined}
      className={cx(styles.button, styles[size], selected && styles.selected, className)}
      {...props}
    />
  ),
)
IconButton.displayName = 'IconButton'
