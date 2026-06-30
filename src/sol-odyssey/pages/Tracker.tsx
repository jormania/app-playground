import { useEffect, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { Notice } from '../components/Notice'
import { SupportingNote } from '../components/SupportingNote'
import { Sparkline } from '../components/Sparkline'
import { Modal } from '../components/Modal'
import { Switch } from '../components/Switch'
import { Textarea } from '../components/Textarea'
import { Button } from '../components/Button'
import { useSettings } from '../lib/settingsContext'
import { isConfigured } from '../lib/settings'
import { useActiveOdysseys } from '../lib/useActiveOdysseys'
import { useCheckins, useUpsertCheckin } from '../lib/useCheckins'
import { useReflections } from '../lib/useReflections'
import { CYCLE_DAYS, isoAddDays, todayISO } from '../lib/charter'
import {
  bestStreak,
  canSaveCheckin,
  currentStreak,
  cycleState,
  shouldWarnDontSkipTwice,
  EMPTY_CHECKIN,
  type CheckinDraft,
  type CheckinRecord,
} from '../lib/checkins'
import { cn } from '../lib/cn'

type CellState = 'done' | 'miss' | 'today' | 'future'

interface CellInfo {
  state: CellState
  rec?: CheckinRecord
  hasEntry: boolean
  editable: boolean
}

export function TrackerPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const checkins = useCheckins(odyssey?.id)
  const reflections = useReflections(odyssey?.id)
  const upsert = useUpsertCheckin(odyssey?.id)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [form, setForm] = useState<CheckinDraft>(EMPTY_CHECKIN)

  if (!isConfigured(settings)) {
    return <Notice title="Connect Notion first" body="Add your token and database links in Settings." actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }
  if (active.isPending) return <p className="font-sans text-text-secondary">Loading…</p>
  if (!odyssey || !odyssey.startDate) {
    return <Notice title="No Odyssey under way" body="Start one to see its tracker." actionLabel="Start an Odyssey" onAction={() => navigate('/charter')} />
  }

  const start = odyssey.startDate
  const records = checkins.data ?? []
  const recordByDate = new Map(records.map((r) => [r.date, r]))
  const cycle = cycleState(start)
  const today = todayISO()

  const current = currentStreak(records, today)
  const best = bestStreak(records)
  const warn = cycle.phase === 'active' && shouldWarnDontSkipTwice(records, today)
  const toSummit = Math.max(0, CYCLE_DAYS - Math.max(0, Math.min(cycle.dayIndex, CYCLE_DAYS)))
  const temps = (reflections.data ?? [])
    .filter((r) => r.temperature >= 1)
    .map((r) => ({ week: r.weekIndex, temperature: r.temperature }))

  // Days that have already happened (day 1 … today) can be opened to view, edit, or back-fill.
  const lastOccurredDay = cycle.dayIndex >= 1 ? Math.min(cycle.dayIndex, CYCLE_DAYS) : 0

  function cellInfo(dayIndex: number): CellInfo {
    const date = isoAddDays(start, dayIndex - 1)
    const rec = recordByDate.get(date)
    let state: CellState
    if (rec?.done) state = 'done'
    else if (dayIndex === cycle.dayIndex) state = 'today'
    else if (dayIndex < cycle.dayIndex) state = 'miss'
    else state = 'future'
    return {
      state,
      rec,
      hasEntry: Boolean(rec && (rec.oneLine.trim() || rec.friction.trim())),
      editable: dayIndex <= lastOccurredDay,
    }
  }

  const openDate = openDay != null ? isoAddDays(start, openDay - 1) : ''
  const openRec = openDay != null ? recordByDate.get(openDate) : undefined

  // Seed the editor when a day is opened.
  useEffect(() => {
    if (openDay == null) return
    setForm(
      openRec
        ? { done: openRec.done, oneLine: openRec.oneLine, friction: openRec.friction, sentToBuddy: openRec.sentToBuddy }
        : EMPTY_CHECKIN,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDay, openRec?.id])

  function saveDay() {
    if (openDay == null || !odyssey) return
    const isToday = openDate === today
    upsert.mutate(
      {
        odysseyId: odyssey.id,
        odysseyNumber: odyssey.number ?? 1,
        dateISO: openDate,
        dayIndex: openDay,
        existingId: openRec?.id,
        // Mark a back-filled past day as logged-late (keep an existing marker if there is one).
        draft: { ...form, loggedLate: openRec ? openRec.loggedLate : !isToday },
      },
      { onSuccess: () => setOpenDay(null) },
    )
  }

  const columnLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(`${isoAddDays(start, i)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }),
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">
          {cycle.phase === 'before'
            ? `Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'}`
            : cycle.phase === 'after'
              ? '42 days complete'
              : `${toSummit} day${toSummit === 1 ? '' : 's'} to the summit`}
        </span>
        <h2 className="font-display text-2xl">Tracker</h2>
      </header>

      <div className="flex gap-3">
        <Stat label="Current streak" value={current} />
        <Stat label="Best streak" value={best} />
      </div>

      {warn && (
        <div role="status" className="rounded-md border border-caution/40 bg-background-secondary p-4">
          <p className="font-sans text-sm text-text-primary">
            Yesterday slipped — no harm done. The one rule of the grid is simple: never skip two days
            running. A small step today keeps the groove.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-tertiary bg-background-secondary p-5">
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1.5">
          <span />
          {columnLabels.map((l, i) => (
            <span key={i} className="text-center font-mono text-xs text-text-secondary">
              {l}
            </span>
          ))}
          {Array.from({ length: 6 }, (_, w) => (
            <Week key={w} week={w + 1} cellInfo={cellInfo} onOpen={setOpenDay} />
          ))}
        </div>
      </div>

      {temps.length > 0 && (
        <div className="rounded-lg border border-tertiary bg-background-secondary p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Temperature · how installed it feels
          </p>
          <div className="mt-3">
            {temps.length === 1 ? (
              <p className="font-sans text-text-primary">
                Week {temps[0].week} · <span className="font-mono">{temps[0].temperature}/10</span>{' '}
                <span className="text-sm text-text-secondary">— the trend line appears from week 2.</span>
              </p>
            ) : (
              <Sparkline points={temps} />
            )}
          </div>
        </div>
      )}

      <SupportingNote note="trackerLegend" />
      <SupportingNote note="flexibleStreak" />
      <SupportingNote note="selfCompassion" />

      <Modal open={openDay != null} onClose={() => setOpenDay(null)} title={`Day ${openDay ?? ''}`}>
        <div className="flex flex-col gap-4">
          {openDate && openDate !== today && (
            <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
              {openDate} · catching up on a past day{openRec?.loggedLate ? ' · logged late' : ''}
            </p>
          )}
          <Switch
            label="Did the tiny version"
            checked={form.done}
            onCheckedChange={(v) => setForm((f) => ({ ...f, done: v }))}
          />
          <Textarea
            label="One line"
            required
            placeholder="What happened, or what you noticed."
            rows={2}
            value={form.oneLine}
            onChange={(e) => setForm((f) => ({ ...f, oneLine: e.target.value }))}
          />
          <Textarea
            label="Friction (optional)"
            rows={2}
            value={form.friction}
            onChange={(e) => setForm((f) => ({ ...f, friction: e.target.value }))}
          />
          <Switch
            label="Sent to my buddy"
            checked={form.sentToBuddy}
            onCheckedChange={(v) => setForm((f) => ({ ...f, sentToBuddy: v }))}
          />
          {upsert.isError && <p role="alert" className="font-sans text-sm text-caution">{upsert.error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDay(null)} disabled={upsert.isPending}>
              Cancel
            </Button>
            <Button onClick={saveDay} disabled={!canSaveCheckin(form) || upsert.isPending}>
              {upsert.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}
              {openRec ? 'Update day' : 'Save day'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Week({
  week,
  cellInfo,
  onOpen,
}: {
  week: number
  cellInfo: (day: number) => CellInfo
  onOpen: (day: number) => void
}) {
  return (
    <>
      <span className="flex items-center font-mono text-xs text-text-secondary">W{week}</span>
      {Array.from({ length: 7 }, (_, d) => {
        const dayIndex = (week - 1) * 7 + d + 1
        const { state, rec, editable } = cellInfo(dayIndex)
        const classes = cn(
          'relative aspect-square rounded-md border transition-colors duration-fast',
          state === 'done' && 'border-accent bg-accent',
          state === 'miss' && 'border-secondary bg-background-primary',
          state === 'today' && 'border-accent bg-accent-soft ring-1 ring-accent',
          state === 'future' && 'border-tertiary bg-background-tertiary/40',
          editable && 'cursor-pointer hover:opacity-80 focus-visible:outline-none',
        )
        const sentMark = rec?.sentToBuddy ? (
          <Check
            size={11}
            aria-hidden
            className={cn(
              'absolute bottom-0 right-0.5',
              state === 'done' ? 'text-accent-contrast' : 'text-accent',
            )}
          />
        ) : null

        return editable ? (
          <button key={d} type="button" title={`Day ${dayIndex} — view or edit`} onClick={() => onOpen(dayIndex)} className={classes}>
            {sentMark}
          </button>
        ) : (
          <span key={d} title={`Day ${dayIndex}`} className={classes}>
            {sentMark}
          </span>
        )
      })}
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-md border border-tertiary bg-background-secondary p-4">
      <span className="font-display text-2xl text-text-primary">{value}</span>
      <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</span>
    </div>
  )
}
