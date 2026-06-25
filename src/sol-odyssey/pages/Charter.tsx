import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Textarea } from '../components/Textarea'
import { Switch } from '../components/Switch'
import { SupportingNote } from '../components/SupportingNote'
import { useSettings } from '../lib/settingsContext'
import { useActiveOdysseys, ACTIVE_ODYSSEYS_KEY } from '../lib/useActiveOdysseys'
import { createActiveOdyssey, type OdysseyRef } from '../lib/notion'
import {
  canActivate,
  charterErrors,
  computeEndDate,
  emptyDraft,
  type CharterDraft,
} from '../lib/charter'
import type { GuidanceKey } from '../content/guidance'

interface FieldStep {
  key: keyof CharterDraft
  kind: 'text' | 'date'
  title: string
  label: string
  placeholder?: string
  hint?: string
  optional?: boolean
  note?: GuidanceKey
}

const FIELD_STEPS: FieldStep[] = [
  { key: 'behaviour', kind: 'text', title: 'The wish', label: 'What do you want to practise?', placeholder: 'e.g. Move my body before the day takes me.', hint: 'Say it plainly, in your own voice.' },
  { key: 'outcomePicture', kind: 'text', title: 'The benefit', label: 'Picture the payoff, vividly', placeholder: 'What does life feel like once this is part of you?', note: 'outcomePicture' },
  { key: 'identity', kind: 'text', title: 'Identity', label: 'I am someone who…', placeholder: '…starts the day in motion.', note: 'identity' },
  { key: 'tinyVersion', kind: 'text', title: 'Tiny version', label: 'The 2-minute floor', placeholder: 'So small you can’t fail on a bad day.', note: 'tinyFloor' },
  { key: 'anchor', kind: 'text', title: 'Anchor', label: 'After I…', placeholder: '…pour my first coffee, I will…', note: 'anchor' },
  { key: 'ifThen', kind: 'text', title: 'If-then', label: 'The known obstacle', placeholder: 'If [obstacle], then [your pre-decided response].', note: 'ifThen' },
  { key: 'pairing', kind: 'text', title: 'Pairing', label: 'Pair it with something you enjoy (optional)', placeholder: 'Optional — leave blank if none.', optional: true },
  { key: 'dailySuccess', kind: 'text', title: 'Daily success', label: 'What counts as done?', placeholder: 'The lowest clear bar: did it / didn’t.' },
  { key: 'whyValue', kind: 'text', title: 'Why it matters', label: 'One honest sentence + the value it serves', placeholder: 'What you’ll read on the days the system isn’t enough.', note: 'whyValue' },
  { key: 'startDate', kind: 'date', title: 'Departure', label: 'Start date (Day 1)', hint: 'Defaults to the next Monday — a meaningful start.' },
]

const TOTAL_STEPS = FIELD_STEPS.length + 1 // + review

export function CharterPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const active = useActiveOdysseys()

  const [draft, setDraft] = useState<CharterDraft>(() => emptyDraft())
  const [step, setStep] = useState(0)

  const errors = charterErrors(draft)
  const buddyReady = Boolean(settings.buddyName.trim() && settings.buddyEmail.trim())

  const create = useMutation<OdysseyRef, Error>({
    mutationFn: () => createActiveOdyssey(settings, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY })
      queryClient.invalidateQueries({ queryKey: ['odysseyHistory'] })
      queryClient.invalidateQueries({ queryKey: ['odysseyArchive'] })
      navigate('/')
    },
  })

  // Already running an Odyssey → don't offer a second (Law I).
  if (active.data && active.data.length > 0) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h2 className="font-display text-2xl">One Odyssey at a time</h2>
        <p className="max-w-prose font-sans text-text-secondary">
          You already have an active Odyssey — <strong>{active.data[0].title}</strong>. Finish or
          retire it before starting another. One piece of cargo per voyage is the whole advantage.
        </p>
        <div>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </div>
    )
  }

  const setField = (key: keyof CharterDraft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const onReview = step === FIELD_STEPS.length
  const current = onReview ? undefined : FIELD_STEPS[step]
  const stepInvalid = current
    ? Boolean(errors[current.key]) && !current.optional
    : false

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs text-text-secondary">
          Charter · step {step + 1} of {TOTAL_STEPS}
        </span>
        <div className="h-1.5 overflow-hidden rounded-pill bg-background-tertiary">
          <div
            className="h-full rounded-pill bg-accent transition-all duration-base"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      {current && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">{current.title}</h2>
          {current.kind === 'date' ? (
            <Field
              label={current.label}
              type="date"
              hint={current.hint}
              value={draft.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
            />
          ) : (
            <Textarea
              label={current.label}
              placeholder={current.placeholder}
              hint={current.hint}
              rows={3}
              value={String(draft[current.key])}
              onChange={(e) => setField(current.key, e.target.value)}
            />
          )}
          {errors[current.key] && !current.optional && (
            <p className="font-sans text-sm text-caution">{errors[current.key]}</p>
          )}
          {current.note && <SupportingNote note={current.note} />}
        </section>
      )}

      {onReview && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl">Before you depart</h2>
          <div className="rounded-lg border border-tertiary bg-background-secondary p-5">
            <p className="font-display text-lg">{draft.behaviour}</p>
            <dl className="mt-3 grid gap-2 font-sans text-sm">
              <Row label="I am someone who" value={draft.identity} />
              <Row label="Tiny version" value={draft.tinyVersion} />
              <Row label="Anchor" value={draft.anchor} />
              <Row label="If-then" value={draft.ifThen} />
              <Row label="Daily success" value={draft.dailySuccess} />
              <Row label="Runs" value={`${draft.startDate} → ${computeEndDate(draft.startDate)} (42 days)`} />
            </dl>
          </div>

          <div className="rounded-lg border border-tertiary bg-background-secondary p-5">
            <Switch
              label="Would you bet €50 you’ll do this every single day for 42 days?"
              description="If not, it’s still too big — go back and shrink the tiny version."
              checked={draft.confirmedShrink}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, confirmedShrink: v }))}
            />
            <div className="mt-3">
              <SupportingNote note="shrinkTest" />
            </div>
          </div>

          {!buddyReady && (
            <div role="alert" className="rounded-md border border-caution/40 bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">
                One human buddy is required before you set out. Add their name and email in{' '}
                <button className="font-medium text-accent underline" onClick={() => navigate('/settings')}>
                  Settings
                </button>
                .
              </p>
            </div>
          )}

          {create.isError && (
            <div role="alert" className="rounded-md border border-caution/40 bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">{create.error.message}</p>
            </div>
          )}
        </section>
      )}

      <footer className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
          disabled={create.isPending}
        >
          <ArrowLeft size={18} aria-hidden />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {onReview ? (
          <Button
            onClick={() => create.mutate()}
            disabled={!canActivate(draft) || !buddyReady || create.isPending}
          >
            {create.isPending ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={18} aria-hidden />
            )}
            Begin the Odyssey
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)} disabled={stepInvalid}>
            Next
            <ArrowRight size={18} aria-hidden />
          </Button>
        )}
      </footer>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-tertiary pt-2 first:border-0 first:pt-0">
      <dt className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{value || <span className="text-text-secondary">—</span>}</dd>
    </div>
  )
}
