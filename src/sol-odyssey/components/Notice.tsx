import { Button } from './Button'

/** A calm full-width message card with an optional action — used for empty / not-connected /
 *  error states across the home screens. */
export function Notice({
  title,
  body,
  actionLabel,
  onAction,
  titleAs: TitleTag = 'h2',
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  /** Use `h3` when the page already has an `h2` header above the notice (keeps one h2 per page). */
  titleAs?: 'h2' | 'h3'
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
      <TitleTag className="font-display text-2xl">{title}</TitleTag>
      <p className="max-w-prose font-sans text-text-secondary">{body}</p>
      {actionLabel && onAction && (
        <div>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  )
}
