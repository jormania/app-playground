import { Loader2, MessageCircleHeart, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { useCompanion } from '../lib/useCompanion'
import type { CompanionPrompt } from '../lib/companion'

/** The optional AI companion — a brief reflective witness for the in-between. Deliberately quiet
 *  and visually distinct from the human-buddy elements: it is never the buddy and never replaces
 *  one. Ephemeral: the reflection lives only in this view. */
export function CompanionPanel({ prompt }: { prompt: CompanionPrompt }) {
  const companion = useCompanion()
  const reflection = companion.data

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-accent/20 bg-accent-soft p-5">
      <header className="flex items-center gap-2">
        <MessageCircleHeart size={18} className="text-accent" aria-hidden />
        <h3 className="font-display text-lg">Reflect with your companion</h3>
      </header>
      <p className="font-sans text-sm text-text-secondary">
        An optional witness for the in-between — it mirrors back what you wrote. Your buddy is still
        the heart of this.
      </p>

      {reflection && (
        <blockquote className="border-l-2 border-accent/40 pl-4 font-sans text-text-primary">
          {reflection}
        </blockquote>
      )}

      {companion.isError && (
        <p role="alert" className="font-sans text-sm text-caution">
          {companion.error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => companion.mutate(prompt)} disabled={companion.isPending}>
          {companion.isPending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : reflection ? (
            <RefreshCw size={18} aria-hidden />
          ) : (
            <MessageCircleHeart size={18} aria-hidden />
          )}
          {reflection ? 'Reflect again' : 'Reflect with your companion'}
        </Button>
        {reflection && (
          <span className="font-mono text-xs text-text-secondary">Not saved — just for this moment.</span>
        )}
      </div>
    </section>
  )
}
