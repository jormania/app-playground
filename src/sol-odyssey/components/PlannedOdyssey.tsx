import { useState } from 'react'
import { CalendarClock, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
import { computeDayIndex } from '../lib/charter'
import {
  useActivatePlanningOdyssey,
  useDiscardPlanningDraft,
} from '../lib/usePlanningOdyssey'
import { useNextOdysseyNumber } from '../lib/useNextOdysseyNumber'
import { parseDraftToCharter } from '../lib/charter'
import type { OdysseyDetail } from '../lib/notion'

/** How a draft's start date reads, and whether it's ready to begin now. */
function startState(draft: OdysseyDetail): { label: string; ready: boolean } {
  if (!draft.startDate) return { label: 'No start date set yet', ready: true }
  const day = computeDayIndex(draft.startDate)
  if (day >= 1) return { label: `Start date reached · ${draft.startDate}`, ready: true }
  const days = 1 - day
  return { label: `Starts ${draft.startDate} · in ${days} day${days === 1 ? '' : 's'}`, ready: false }
}

/** Full card for the "a draft is prepared and nothing is Active" state — the planned Odyssey is
 *  ready to edit, begin, or discard. */
export function PlannedOdysseyCard({
  draft,
  navigate,
}: {
  draft: OdysseyDetail
  navigate: (to: string) => void
}) {
  const activate = useActivatePlanningOdyssey()
  const history = useNextOdysseyNumber()
  const nextNumber = history.data?.nextNumber
  const { label, ready } = startState(draft)

  function begin() {
    activate.mutate(
      { draftId: draft.id, draft: parseDraftToCharter(draft) },
      { onSuccess: () => navigate('/') },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-accent">
          <CalendarClock size={14} aria-hidden />
          Planned · not yet begun
        </span>
        <h2 className="font-display text-2xl">
          {nextNumber ? `Odyssey ${nextNumber} — ${draft.title || 'Planned Odyssey'}` : draft.title || 'Planned Odyssey'}
        </h2>
        {nextNumber && (
          <p className="font-mono text-xs text-text-secondary">
            The number it’ll take when you begin — not locked in until then.
          </p>
        )}
        {draft.identity && (
          <p className="font-display text-lg text-text-secondary">{draft.identity}</p>
        )}
      </header>

      <dl className="grid gap-3">
        <Readout label="Tiny version" value={draft.tinyVersion} />
        <Readout label="Anchor" value={draft.anchor} />
        <Readout label="Daily success" value={draft.dailySuccess} />
        <Readout label="Departure" value={label} />
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={begin} disabled={activate.isPending}>
          {activate.isPending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size={18} aria-hidden />
          )}
          {ready ? 'Ready — begin now' : 'Begin now'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/charter')} disabled={activate.isPending}>
          <Pencil size={18} aria-hidden />
          Continue editing
        </Button>
        <DiscardButton draftId={draft.id} />
      </div>

      {!ready && (
        <p className="font-sans text-sm text-text-secondary">
          You can begin before the start date — the daily loop will simply count down to Day 1.
        </p>
      )}

      {activate.isError && (
        <p role="alert" className="font-sans text-sm text-caution">
          {activate.error.message}
        </p>
      )}
    </div>
  )
}

/** Compact strip for the "an Odyssey is Active and a draft is lined up for next" state — edit or
 *  discard only; it can't be begun until the current Odyssey is harvested. */
export function PlannedOdysseyStrip({
  draft,
  navigate,
}: {
  draft: OdysseyDetail
  navigate: (to: string) => void
}) {
  const history = useNextOdysseyNumber()
  const nextNumber = history.data?.nextNumber
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-text-secondary">
          <CalendarClock size={14} aria-hidden />
          {nextNumber ? `Odyssey ${nextNumber} · lined up for next` : 'Lined up for next'}
        </span>
        <p className="font-sans text-text-primary">{draft.title || 'A planned Odyssey'}</p>
        <p className="font-sans text-sm text-text-secondary">
          You can begin it once you harvest your current Odyssey.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" onClick={() => navigate('/charter')}>
          <Pencil size={18} aria-hidden />
          Continue editing
        </Button>
        <DiscardButton draftId={draft.id} />
      </div>
    </div>
  )
}

function DiscardButton({ draftId }: { draftId: string }) {
  const [open, setOpen] = useState(false)
  const discard = useDiscardPlanningDraft()

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} disabled={discard.isPending}>
        <Trash2 size={18} aria-hidden />
        Discard
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Discard this planned Odyssey?">
        <p className="font-sans text-sm text-text-secondary">
          The draft moves to your Notion Trash (recoverable for 30 days). Nothing else is affected.
        </p>
        {discard.isError && (
          <p role="alert" className="mt-3 font-sans text-sm text-caution">
            {discard.error.message}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={discard.isPending}>
            Keep it
          </Button>
          <Button
            onClick={() => discard.mutate(draftId, { onSuccess: () => setOpen(false) })}
            disabled={discard.isPending}
          >
            {discard.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Trash2 size={18} aria-hidden />}
            Discard
          </Button>
        </div>
      </Modal>
    </>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-tertiary bg-background-secondary p-4">
      <dt className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="font-sans text-text-primary">{value}</dd>
    </div>
  )
}
