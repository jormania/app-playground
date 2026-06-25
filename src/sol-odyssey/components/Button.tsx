import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

// All colours/radii reference Claude Design System tokens via the mapped Tailwind names
// (see tailwind.config.js) — never raw hex.
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium ' +
    'transition-colors duration-base disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus-visible:outline-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
        secondary:
          'bg-background-secondary text-text-primary border border-primary hover:bg-background-tertiary',
        ghost: 'bg-transparent text-accent hover:bg-accent-soft',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
