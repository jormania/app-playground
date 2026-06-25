import { useEffect, useState } from 'react'
import { Check, Loader2, Lock, Save } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Textarea } from '../components/Textarea'
import { Select } from '../components/Select'
import { Switch } from '../components/Switch'
import { Notice } from '../components/Notice'
import { SupportingNote } from '../components/SupportingNote'
import { cn } from '../lib/cn'
import { useSettings } from '../lib/settingsContext'
import { isConfigured } from '../lib/settings'
import { useActiveOdysseys } from '../lib/useActiveOdysseys'
import { useCheckins } from '../lib/useCheckins'
import { useReflections, useUpsertReflection } from '../lib/useReflections'
import { cycleState } from '../lib/checkins'
import { todayISO } from '../lib/charter'
import {
  EMPTY_REFLECTION,
  FIT_OPTIONS,
  WEEKS,
  breakPointsRequired,
  canSubmit,
  daysDoneInWeek,
  reflectableWeeks,
  reflectionErrors,
  weekStatus,
  type Fit,
  type ReflectionDraft,
} from '../lib/reflections'

export function WeeklyPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const checkins = useCheckins(odyssey?.id)
  const reflections = useReflections(odyssey?.id)
  const upsert = useUpsertReflection(odyssey?.id)

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [form, setForm] = useState<ReflectionDraft>(EMPTY_REFLECTION)

  const dayIndex = odyssey?.startDate ? cycleState(odyssey.startDate).dayIndex : 0
  const reflectable = reflectableWeeks(dayIndex)
  const recordFor = (week: number) => reflections.data?.find((r) => r.weekIndex === week)

  // Default to the first due week without a reflection, else the latest reflectable week.
  useEffect(() => {
    if (selectedWeek != null || !reflections.data) return
    const due = reflectable.filter((w) => !recordFor(w))
    setSelectedWeek(due[0] ?? reflectable[reflectable.length - 1] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflections.data, dayIndex])

  // Seed the form when the selected week (or its saved record) changes.
  useEffect(() => {
    if (selectedWeek == null) return
    const rec = recordFor(selectedWeek)
    if (rec) {
      setForm({
        daysDone: rec.daysDone,
        breakPoints: rec.breakPoints,
        fit: rec.fit,
        oneAdjustment: rec.oneAdjustment,
        riskPlan: rec.riskPlan,
        temperature: rec.temperature,
        buddyReflected: rec.buddyReflected,
      })
    } else {
      setForm({ ...EMPTY_REFLECTION, daysDone: daysDoneInWeek(checkins.data ?? [], selectedWeek) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, reflections.data, checkins.data])

  if (!isConfigured(settings)) {
    return <Notice title="Connect Notion first" body="Add your token and database links in Settings." actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }
  if (active.isPending) return <p className="font-sans text-text-secondary">Loading…</p>
  if (!odyssey) {
    return <Notice title="No Odyssey under way" body="Start one to begin its weekly reflections." actionLabel="Start an Odyssey" onAction={() => navigate('/charter')} />
  }

  const errors = reflectionErrors(form)
  const selectedStatus = selectedWeek != null ? weekStatus(selectedWeek, dayIndex, Boolean(recordFor(selectedWeek))) : 'locked'
  const editable = selectedStatus !== 'locked'

  function save() {
    if (selectedWeek == null || !odyssey) return
    upsert.mutate({
      odysseyId: odyssey.id,
      odysseyNumber: odyssey.number ?? 1,
      weekIndex: selectedWeek,
      dateISO: todayISO(),
      existingId: recordFor(selectedWeek)?.id,
      draft: form,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">Weekly reflection · the five questions</span>
        <h2 className="font-display text-2xl">Read the week. Change one thing.</h2>
      </header>

      {/* Week rail */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: WEEKS }, (_, i) => {
          const week = i + 1
          const status = weekStatus(week, dayIndex, Boolean(recordFor(week)))
          const isSelected = week === selectedWeek
          return (
            <button
              key={week}
              disabled={status === 'locked'}
              onClick={() => setSelectedWeek(week)}
              className={cn(
                'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 font-sans text-sm transition-colors duration-fast',
                status === 'locked' && 'cursor-not-allowed border-tertiary text-text-secondary/60',
                status === 'due' && !isSelected && 'border-secondary text-text-primary hover:bg-background-secondary',
                status === 'done' && !isSelected && 'border-secondary text-text-secondary hover:bg-background-secondary',
                isSelected && 'border-accent bg-accent-soft text-accent',
              )}
            >
              {status === 'locked' && <Lock size={13} aria-hidden />}
              {status === 'done' && <Check size={13} aria-hidden />}
              Week {week}
            </button>
          )
        })}
      </div>

      {!editable && (
        <Notice
          title="Not yet"
          body={
            reflectable.length === 0
              ? 'Your first weekly reflection unlocks at the end of week 1. Keep turning the daily loop until then.'
              : `Week ${selectedWeek} unlocks at the end of that week. Reflect on the weeks already complete.`
          }
        />
      )}

      {editable && selectedWeek != null && (
        <section className="flex flex-col gap-5">
          {recordFor(selectedWeek) && (
            <p className="font-sans text-sm text-text-secondary">
              You’ve reflected on week {selectedWeek} — edits update it.
            </p>
          )}

          <Question n={1} title="The data" imperative="Count, don’t judge.">
            <Field
              label="How many of the seven days did the tiny version happen?"
              type="number"
              min={0}
              max={7}
              value={String(form.daysDone)}
              onChange={(e) => setForm((f) => ({ ...f, daysDone: clampInt(e.target.value, 0, 7) }))}
            />
            {errors.daysDone && <p className="font-sans text-sm text-caution">{errors.daysDone}</p>}
          </Question>

          <Question n={2} title="The break points" imperative="Find the pattern beneath the miss.">
            <Textarea
              label="Where did it slip? What was the real cue or obstacle?"
              required={breakPointsRequired(form)}
              hint={breakPointsRequired(form) ? undefined : 'A clean week — optional this time.'}
              rows={2}
              value={form.breakPoints}
              onChange={(e) => setForm((f) => ({ ...f, breakPoints: e.target.value }))}
            />
            {errors.breakPoints && <p className="font-sans text-sm text-caution">{errors.breakPoints}</p>}
          </Question>

          <Question n={3} title="The fit" imperative="Size is a dial, not a failure.">
            <Select
              label="Was the behaviour…"
              placeholder="Choose…"
              value={form.fit}
              options={FIT_OPTIONS.map((f) => ({ value: f, label: f }))}
              onChange={(e) => setForm((fm) => ({ ...fm, fit: e.target.value as Fit | '' }))}
            />
            {errors.fit && <p className="font-sans text-sm text-caution">{errors.fit}</p>}
          </Question>

          <Question n={4} title="The adjustment" imperative="One lever only.">
            <Textarea
              label="Choose exactly one change for next week."
              required
              rows={2}
              value={form.oneAdjustment}
              onChange={(e) => setForm((f) => ({ ...f, oneAdjustment: e.target.value }))}
            />
            {errors.oneAdjustment && <p className="font-sans text-sm text-caution">{errors.oneAdjustment}</p>}
            <div className="mt-2"><SupportingNote note="oneLever" /></div>
          </Question>

          <Question n={5} title="The temperature" imperative="Track the shift toward automatic.">
            <p className="font-sans text-sm text-text-secondary">How installed does this feel? (1–10)</p>
            <TemperatureScale value={form.temperature} onChange={(t) => setForm((f) => ({ ...f, temperature: t }))} />
            {errors.temperature && <p className="font-sans text-sm text-caution">{errors.temperature}</p>}
            <div className="mt-2"><SupportingNote note="temperature" /></div>
          </Question>

          <section className="flex flex-col gap-2 rounded-lg border border-dashed border-tertiary bg-background-secondary p-5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">Optional</span>
              <h3 className="font-display text-lg">Riskiest moment next week</h3>
            </div>
            <Textarea
              label="Name the riskiest moment next week + your coping plan"
              rows={2}
              value={form.riskPlan}
              onChange={(e) => setForm((f) => ({ ...f, riskPlan: e.target.value }))}
            />
          </section>

          <Switch
            label="Reflected with my buddy"
            description="A self-marked note — the app contacts no one."
            checked={form.buddyReflected}
            onCheckedChange={(v) => setForm((f) => ({ ...f, buddyReflected: v }))}
          />

          <SupportingNote note="weeklyReflect" />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={!canSubmit(form) || upsert.isPending}>
              {upsert.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
              {recordFor(selectedWeek) ? 'Update week ' + selectedWeek : 'Save week ' + selectedWeek}
            </Button>
            {upsert.isSuccess && !upsert.isPending && (
              <span className="font-sans text-sm text-text-secondary">
                {upsert.data?.queued ? 'Saved · will sync' : 'Saved.'}
              </span>
            )}
          </div>

          {upsert.isError && <p role="alert" className="font-sans text-sm text-caution">{upsert.error.message}</p>}
        </section>
      )}
    </div>
  )
}

function Question({ n, title, imperative, children }: { n: number; title: string; imperative: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-tertiary bg-background-secondary p-5">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-lg text-accent">{n}</span>
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">{imperative}</p>
      <div className="mt-1 flex flex-col gap-1">{children}</div>
    </section>
  )
}

function TemperatureScale({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 10 }, (_, i) => {
        const t = i + 1
        const on = value === t
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t)}
            className={cn(
              'h-9 w-9 rounded-md border font-mono text-sm transition-colors duration-fast',
              on ? 'border-accent bg-accent text-accent-contrast' : 'border-secondary text-text-primary hover:bg-background-tertiary',
            )}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
