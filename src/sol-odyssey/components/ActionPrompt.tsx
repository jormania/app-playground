import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

/** A calm-but-clear "there's something to do elsewhere" prompt. Gentle accent colours (never a
 *  warning), a contextual icon in a softly-pulsing ring to draw the eye, and an obvious call to
 *  action. Two weights: `soft` (a nudge) and `solid` (a milestone — e.g. the summit). */
export function ActionPrompt({
  icon: Icon,
  children,
  cta,
  onAction,
  variant = 'soft',
}: {
  icon: LucideIcon
  children: React.ReactNode
  cta: string
  onAction: () => void
  variant?: 'soft' | 'solid'
}) {
  const solid = variant === 'solid'
  return (
    <button
      onClick={onAction}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors duration-fast',
        solid
          ? 'border-accent bg-accent text-accent-contrast hover:bg-accent-hover'
          : 'border-accent/30 bg-accent-soft text-text-primary hover:bg-accent-soft/70',
      )}
    >
      <span
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          solid ? 'bg-accent-contrast/15 text-accent-contrast' : 'bg-accent/15 text-accent',
        )}
      >
        <Icon size={18} aria-hidden />
        {/* the gentle pulse ring — calm, reduced-motion-safe */}
        <span
          className={cn(
            'sol-pulse pointer-events-none absolute inset-0 rounded-full ring-2',
            solid ? 'ring-accent-contrast/50' : 'ring-accent/40',
          )}
          aria-hidden
        />
      </span>
      <span className="flex-1 font-sans text-sm">{children}</span>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 font-sans text-sm font-medium',
          solid ? 'text-accent-contrast' : 'text-accent',
        )}
      >
        {cta}
        <ArrowRight size={16} aria-hidden className="transition-transform duration-fast group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
