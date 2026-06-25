import { cn } from '../lib/cn'

/** The single affordance for lateral navigation between screens (Tracker → / ← Today). Buttons
 *  are reserved for actions; moving between pages always looks like this. */
export function PageLink({
  label,
  to,
  navigate,
  back = false,
  className,
}: {
  label: string
  to: string
  navigate: (to: string) => void
  back?: boolean
  className?: string
}) {
  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        'font-sans text-sm text-accent transition-colors duration-fast hover:underline',
        className,
      )}
    >
      {back ? '← ' : ''}
      {label}
      {back ? '' : ' →'}
    </button>
  )
}
