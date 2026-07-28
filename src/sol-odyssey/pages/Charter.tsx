import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2, Save, Sparkles } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Textarea } from '../components/Textarea'
import { Switch } from '../components/Switch'
import { SupportingNote } from '../components/SupportingNote'
import { useSettings } from '../lib/settingsContext'
import { isValidEmail } from '../lib/settings'
import { Notice } from '../components/Notice'
import { useActiveOdysseys, useUpdateActiveOdyssey, ACTIVE_ODYSSEYS_KEY } from '../lib/useActiveOdysseys'
import {
  usePlanningOdyssey,
  useSavePlanningDraft,
  useActivatePlanningOdyssey,
} from '../lib/usePlanningOdyssey'
import { createActiveOdyssey, type OdysseyRef } from '../lib/notion'
import {
  canActivate,
  charterErrors,
  computeDayIndex,
  computeEndDate,
  defaultStartDate,
  emptyDraft,
  firstIncompleteStep,
  parseDraftToCharter,
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
  { key: 'behaviour', kind: 'text', title: 'The wish', label: 'What do you want to practise?', placeholder: 'e.g. Move my body before the day takes me.', hint: 'Say it plainly, in your own voice.', note: 'theWish' },
  { key: 'outcomePicture', kind: 'text', title: 'The benefit', label: 'Picture the payoff, vividly', placeholder: 'What does life feel like once this is part of you?', note: 'outcomePicture' },
  { key: 'identity', kind: 'text', title: 'Identity', label: 'I am someone who…', placeholder: '…starts the day in motion.', note: 'identity' },
  { key: 'tinyVersion', kind: 'text', title: 'Tiny version', label: 'The 2-minute floor', placeholder: 'So small you can’t fail on a bad day.', note: 'tinyFloor' },
  { key: 'anchor', kind: 'text', title: 'Anchor', label: 'After I…', placeholder: '…pour my first coffee, I will…', note: 'anchor' },
  { key: 'ifThen', kind: 'text', title: 'If-then', label: 'The known obstacle', placeholder: 'If [obstacle], then [your pre-decided response].', note: 'ifThen' },
  { key: 'pairing', kind: 'text', title: 'Pairing', label: 'Pair it with something you enjoy (optional)', placeholder: 'Optional — leave blank if none.', optional: true, note: 'pairing' },
  { key: 'dailySuccess', kind: 'text', title: 'Daily success', label: 'What counts as done?', placeholder: 'The lowest clear bar: did it / didn’t.', note: 'dailySuccess' },
  { key: 'whyValue', kind: 'text', title: 'Why it matters', label: 'One honest sentence + the value it serves', placeholder: 'What you’ll read on the days the system isn’t enough.', note: 'whyValue' },
  { key: 'startDate', kind: 'date', title: 'Departure', label: 'Start date (Day 1)', hint: 'Defaults to the next Monday — a meaningful start.', note: 'startDate' },
]

const TOTAL_STEPS = FIELD_STEPS.length + 1 // + review

export function CharterPage({
  navigate,
  editActive = false,
}: {
  navigate: (to: string) => void
  /** Edit an already-Active Odyssey that hasn't reached Day 1 yet, in place — PATCHes the same row
   *  instead of creating/activating one. Only ever reached via `/charter/edit`. */
  editActive?: boolean
}) {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const active = useActiveOdysseys()
  const planning = usePlanningOdyssey()

  const [draft, setDraft] = useState<CharterDraft>(() =>
    emptyDraft(new Date(), defaultStartDate(new Date(), settings.defaultStart)),
  )
  const [step, setStep] = useState(0)
  // The Notion id of the Planning draft being edited (null until one is saved/loaded). Drives
  // whether saving PATCHes the existing row and whether "Begin" activates it vs creates fresh.
  const [draftId, setDraftId] = useState<string | null>(null)
  // The Active Odyssey being edited in place (editActive mode only) — its id + number, so the
  // PATCH never has to guess either.
  const [activeEditId, setActiveEditId] = useState<string | null>(null)
  const [activeEditNumber, setActiveEditNumber] = useState<number | null>(null)

  const hasActive = Boolean(active.data && active.data.length > 0)
  const editTarget = active.data?.[0]
  const editTargetDay = editTarget?.startDate ? computeDayIndex(editTarget.startDate) : null
  // Guard: editActive only ever makes sense for the sole Active Odyssey, and only before Day 1.
  const editableNow = Boolean(editTarget) && editTargetDay != null && editTargetDay < 1

  // Resume an existing draft once, when it loads — seed the fields and remember its id.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    if (editActive) {
      if (!active.isPending && editTarget && editableNow) {
        setDraft(parseDraftToCharter(editTarget))
        setActiveEditId(editTarget.id)
        setActiveEditNumber(editTarget.number)
        seeded.current = true
      }
      return
    }
    if (planning.data) {
      const resumed = parseDraftToCharter(planning.data)
      setDraft(resumed)
      setDraftId(planning.data.id)
      // Resume where they left off: the first field still empty, or the review step if the charter
      // is already complete (e.g. after a quick detour to Settings to add their buddy).
      setStep(firstIncompleteStep(resumed, FIELD_STEPS.map((s) => s.key)))
      seeded.current = true
    }
  }, [editActive, active.isPending, editTarget, editableNow, planning.data])

  const errors = charterErrors(draft)
  const buddyReady = Boolean(settings.buddyName.trim()) && isValidEmail(settings.buddyEmail)

  const save = useSavePlanningDraft()
  const activate = useActivatePlanningOdyssey()
  const updateActive = useUpdateActiveOdyssey()
  const create = useMutation<OdysseyRef, Error>({
    mutationFn: () => createActiveOdyssey(settings, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_ODYSSEYS_KEY })
      queryClient.invalidateQueries({ queryKey: ['odysseyHistory'] })
      queryClient.invalidateQueries({ queryKey: ['odysseyArchive'] })
      navigate('/')
    },
  })

  const busy = save.isPending || activate.isPending || create.isPending || updateActive.isPending
  const actionError = save.error ?? activate.error ?? create.error ?? updateActive.error

  const setField = (key: keyof CharterDraft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  /** Save (or update) the Planning draft, then go home. */
  function saveDraft() {
    save.mutate(
      { draft, existingId: draftId ?? undefined },
      { onSuccess: () => navigate('/') },
    )
  }

  /** Save the in-progress charter as a draft, THEN go to Settings — so nipping out to add the
   *  buddy never loses the form. On return the wizard resumes from the draft. */
  function goToSettingsKeepingDraft() {
    save.mutate(
      { draft, existingId: draftId ?? undefined },
      { onSuccess: (ref) => { setDraftId(ref.id); navigate('/settings') } },
    )
  }

  /** Begin now: activate the saved draft if there is one, else create the Odyssey fresh. */
  function begin() {
    if (draftId) {
      activate.mutate({ draftId, draft }, { onSuccess: () => navigate('/') })
    } else {
      create.mutate()
    }
  }

  /** PATCH the edited charter onto the Active Odyssey in place, then back to Overview. */
  function saveActiveEdits() {
    if (!activeEditId || activeEditNumber == null) return
    updateActive.mutate(
      { odysseyId: activeEditId, draft, number: activeEditNumber },
      { onSuccess: () => navigate('/overview') },
    )
  }

  const onReview = step === FIELD_STEPS.length
  const current = onReview ? undefined : FIELD_STEPS[step]
  const stepInvalid = current ? Boolean(errors[current.key]) && !current.optional : false

  // editActive only makes sense for the sole Active Odyssey, before Day 1 — once it's loaded, bail
  // out to a calm Notice if that's no longer true (e.g. Day 1 arrived in another tab, or it was
  // harvested elsewhere).
  if (editActive && !active.isPending && !editableNow) {
    return (
      <Notice
        title="Nothing to edit here"
        body="Editing before Day 1 only applies to your current Active Odyssey, before its cycle has started."
        actionLabel="Back to Overview"
        onAction={() => navigate('/overview')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs text-text-secondary">
          Charter · step {step + 1} of {TOTAL_STEPS}
          {editActive ? ' · editing before Day 1' : draftId ? ' · resuming a draft' : ''}
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

          {/* When an Odyssey is already running you can prepare this one, but not begin it yet. */}
          {!editActive && hasActive && (
            <div className="rounded-md border border-tertiary bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">
                You already have an Odyssey under way, so save this as a planned Odyssey. You’ll be
                able to begin it once you harvest your current one.
              </p>
            </div>
          )}

          {editActive && (
            <div className="rounded-md border border-tertiary bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">
                This edits your Odyssey in place — it hasn’t reached Day 1 yet, so nothing here has
                started counting.
              </p>
            </div>
          )}

          {!editActive && !hasActive && !buddyReady && (
            <div className="rounded-md border border-caution/40 bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">
                <strong>Strongly recommended:</strong> one human buddy. Being witnessed beats willpower —
                starting without one is the weakest version of the method. Add their name and email in{' '}
                <button
                  className="font-medium text-accent underline disabled:opacity-60"
                  onClick={goToSettingsKeepingDraft}
                  disabled={busy}
                >
                  Settings
                </button>
                {save.isPending ? ' (saving your charter…)' : ''} — we’ll keep this charter as a draft so
                it’s waiting when you return. You can still begin now and add a witness this week.
              </p>
            </div>
          )}

          {actionError && (
            <div role="alert" className="rounded-md border border-caution/40 bg-background-secondary p-4">
              <p className="font-sans text-sm text-text-primary">{actionError.message}</p>
            </div>
          )}
        </section>
      )}

      <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={() => (step === 0 ? navigate('/') : setStep((s) => s - 1))}
          disabled={busy}
        >
          <ArrowLeft size={18} aria-hidden />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {editActive ? (
            <Button className="w-full sm:w-auto" onClick={saveActiveEdits} disabled={busy}>
              {updateActive.isPending ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <Save size={18} aria-hidden />
              )}
              Save changes
            </Button>
          ) : (
            <>
              {/* Save progress and leave — available throughout, partial drafts allowed. */}
              {!(onReview && !hasActive) && (
                <Button variant="secondary" className="w-full sm:w-auto" onClick={saveDraft} disabled={busy}>
                  {save.isPending ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden />
                  ) : (
                    <Save size={18} aria-hidden />
                  )}
                  {onReview ? 'Save as planned Odyssey' : 'Save draft'}
                </Button>
              )}

              {onReview && !hasActive && (
                <>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={saveDraft} disabled={busy}>
                    {save.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
                    Save as planned
                  </Button>
                  <Button className="w-full sm:w-auto" onClick={begin} disabled={!canActivate(draft) || busy}>
                    {activate.isPending || create.isPending ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden />
                    ) : (
                      <Sparkles size={18} aria-hidden />
                    )}
                    Begin the Odyssey
                  </Button>
                </>
              )}
            </>
          )}

          {!onReview && (
            <Button className="w-full sm:w-auto" onClick={() => setStep((s) => s + 1)} disabled={stepInvalid || busy}>
              Next
              <ArrowRight size={18} aria-hidden />
            </Button>
          )}
        </div>
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
