import { useEffect, useState } from 'react'
import { Check, Loader2, Lock, MessageCircleHeart, Save, Sun } from 'lucide-react'
import { ActionPrompt } from '../components/ActionPrompt'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Textarea } from '../components/Textarea'
import { Select } from '../components/Select'
import { Switch } from '../components/Switch'
import { Notice } from '../components/Notice'
import { SupportingNote } from '../components/SupportingNote'
import { cn } from '../lib/cn'
import { useSettings } from '../lib/settingsContext'
import { isConfigured, companionActive } from '../lib/settings'
import { CompanionPanel } from '../components/CompanionPanel'
import { BuddyEmailButton } from '../components/BuddyEmailButton'
import { buildWeeklyCompanionPrompt } from '../lib/companion'
import { weeklyBuddyMail } from '../lib/buddyMail'
import { useActiveOdysseys, useUpdateTinyVersion } from '../lib/useActiveOdysseys'
import { useCheckins } from '../lib/useCheckins'
import { useReflections, useUpsertReflection } from '../lib/useReflections'
import { cycleState } from '../lib/checkins'
import { todayISO } from '../lib/charter'
import { isNetworkError } from '../lib/sync'
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
  const updateTiny = useUpdateTinyVersion()

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [form, setForm] = useState<ReflectionDraft>(EMPTY_REFLECTION)
  // "Make this my new tiny version" — turns the weekly adjustment into a real change to the loop.
  const [applyTiny, setApplyTiny] = useState(false)
  const [newTiny, setNewTiny] = useState('')

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
    // Reset the "apply tiny version" control for the newly-selected week.
    setApplyTiny(false)
    setNewTiny(odyssey?.tinyVersion ?? '')
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
  // Cross-prompt: while reflecting, nudge to log today if the daily check-in is still pending.
  const cycleActive = dayIndex >= 1 && dayIndex <= 42
  const todayLogged = checkins.data?.some((r) => r.date === todayISO()) ?? false

  const tinyChanged = applyTiny && newTiny.trim().length > 0 && newTiny.trim() !== (odyssey?.tinyVersion ?? '').trim()

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
    // If asked, make the adjustment real: update the tiny version the daily loop reminds you of.
    if (tinyChanged) updateTiny.mutate({ odysseyId: odyssey.id, value: newTiny })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">Weekly reflection · the five questions</span>
        <h2 className="font-display text-2xl">Read the week. Change one thing.</h2>
      </header>

      {cycleActive && !todayLogged && (
        <ActionPrompt icon={Sun} cta="Log today" onAction={() => navigate('/')}>
          Today isn’t logged yet — a minute is all it takes before you reflect.
        </ActionPrompt>
      )}

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
          titleAs="h3"
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

            {/* Make the adjustment real: optionally update the tiny version the daily loop shows. */}
            <div className="mt-3 flex flex-col gap-3 rounded-md border border-dashed border-tertiary bg-background-secondary p-4">
              <Switch
                label="Make this my new tiny version"
                description="Update what the daily loop reminds you to do, from now on."
                checked={applyTiny}
                onCheckedChange={setApplyTiny}
              />
              {applyTiny && (
                <Textarea
                  label="New tiny version"
                  hint="Keep it laughably small — the kind you can’t fail on a bad day."
                  rows={2}
                  value={newTiny}
                  onChange={(e) => setNewTiny(e.target.value)}
                />
              )}
            </div>
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
          <div className="flex flex-wrap items-center gap-3">
            <BuddyEmailButton
              email={weeklyBuddyMail(
                settings.buddyName,
                settings.userName,
                odyssey,
                form,
                selectedWeek,
                tinyChanged ? newTiny : undefined,
              )}
              navigate={navigate}
            />
          </div>

          <SupportingNote note="weeklyReflect" />

          {/* Optional reflective companion — appears once the reflection has substance to mirror; a
              quiet hint before that so it's discoverable. */}
          {companionActive(settings) &&
            (form.oneAdjustment.trim() || form.breakPoints.trim() ? (
              <CompanionPanel prompt={buildWeeklyCompanionPrompt(odyssey, form, selectedWeek)} />
            ) : (
              <p className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent-soft px-4 py-3 font-sans text-sm text-text-secondary">
                <MessageCircleHeart size={16} className="shrink-0 text-accent" aria-hidden />
                Answer the questions above, then your companion can reflect on your week here.
              </p>
            ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={!canSubmit(form) || upsert.isPending}>
              {upsert.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
              {recordFor(selectedWeek) ? 'Update week ' + selectedWeek : 'Save week ' + selectedWeek}
            </Button>
            {upsert.isSuccess && !upsert.isPending && (
              <span className="font-sans text-sm text-text-secondary">
                {upsert.data?.queued ? 'Saved · will sync' : 'Saved.'}
                {updateTiny.isSuccess ? ' Tiny version updated.' : ''}
              </span>
            )}
          </div>

          {upsert.isError && <p role="alert" className="font-sans text-sm text-caution">{upsert.error.message}</p>}
          {updateTiny.isError && (
            <p role="alert" className="font-sans text-sm text-caution">
              Couldn’t update the tiny version: {updateTiny.error.message}
              {isNetworkError(updateTiny.error)
                ? ' Unlike the reflection itself, this doesn’t queue for later — re-apply it once you’re back online.'
                : ''}
            </p>
          )}
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
