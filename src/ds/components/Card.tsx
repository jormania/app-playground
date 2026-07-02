import { forwardRef } from 'react'
import { cx } from '../lib/cx'
import styles from './Card.module.css'

export interface CardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/** A pressable, elevated surface. Owns no opinion about what's inside it —
 *  icon, title, copy stay app-composed — only the chrome: border, shadow,
 *  hover lift, focus ring, and an optional selected state. */
export const Card = forwardRef<HTMLButtonElement, CardProps>(
  ({ selected = false, type = 'button', className, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cx(styles.card, selected && styles.selected, className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
