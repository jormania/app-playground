import { Button } from './Button'

/** A calm full-width message card with an optional action — used for empty / not-connected /
 *  error states across the home screens. */
export function Notice({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="max-w-prose font-sans text-text-secondary">{body}</p>
      {actionLabel && onAction && (
        <div>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  )
}
