import { useState } from 'react'
import { Check } from 'lucide-react'
import { Notice } from '../components/Notice'
import { SupportingNote } from '../components/SupportingNote'
import { Sparkline } from '../components/Sparkline'
import { Modal } from '../components/Modal'
import { useSettings } from '../lib/settingsContext'
import { isConfigured } from '../lib/settings'
import { useActiveOdysseys } from '../lib/useActiveOdysseys'
import { useCheckins } from '../lib/useCheckins'
import { useReflections } from '../lib/useReflections'
import { CYCLE_DAYS, isoAddDays, todayISO } from '../lib/charter'
import {
  bestStreak,
  currentStreak,
  cycleState,
  shouldWarnDontSkipTwice,
  type CheckinRecord,
} from '../lib/checkins'
import { cn } from '../lib/cn'

type CellState = 'done' | 'miss' | 'today' | 'future'

interface CellInfo {
  state: CellState
  rec?: CheckinRecord
  hasEntry: boolean
}

export function TrackerPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const checkins = useCheckins(odyssey?.id)
  const reflections = useReflections(odyssey?.id)
  const [openDay, setOpenDay] = useState<number | null>(null)

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

  function cellInfo(dayIndex: number): CellInfo {
    const date = isoAddDays(start, dayIndex - 1)
    const rec = recordByDate.get(date)
    let state: CellState
    if (rec?.done) state = 'done'
    else if (dayIndex === cycle.dayIndex) state = 'today'
    else if (dayIndex < cycle.dayIndex) state = 'miss'
    else state = 'future'
    return { state, rec, hasEntry: Boolean(rec && (rec.oneLine.trim() || rec.friction.trim())) }
  }

  const openRec = openDay != null ? recordByDate.get(isoAddDays(start, openDay - 1)) : undefined

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
        <p className="mt-4 font-sans text-xs text-text-secondary">
          Filled = a done day. Open = a miss — no crosses, no guilt. Tap any day with a note to read
          it; <Check size={11} className="inline align-middle text-accent" aria-hidden /> marks one
          you sent to your buddy.
        </p>
      </div>

      {temps.length > 0 && (
        <div className="rounded-lg border border-tertiary bg-background-secondary p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Temperature · how installed it feels (1–10)
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

      <SupportingNote note="flexibleStreak" />

      <Modal open={openDay != null} onClose={() => setOpenDay(null)} title={`Day ${openDay ?? ''}`}>
        {openRec ? (
          <div className="flex flex-col gap-3">
            <span
              className={cn(
                'w-fit rounded-pill px-2.5 py-0.5 font-mono text-xs',
                openRec.done ? 'bg-success/15 text-success' : 'bg-caution/15 text-caution',
              )}
            >
              {openRec.done ? 'Done' : 'Missed'}
              {openRec.sentToBuddy ? ' · sent to buddy' : ''}
            </span>
            <Entry label="One line" value={openRec.oneLine} />
            {openRec.friction.trim() && <Entry label="Friction" value={openRec.friction} />}
          </div>
        ) : (
          <p className="font-sans text-sm text-text-secondary">Nothing logged for this day.</p>
        )}
      </Modal>
    </div>
  )
}

function Entry({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <p className="font-sans text-text-primary">{value || <span className="text-text-secondary">—</span>}</p>
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
        const { state, rec, hasEntry } = cellInfo(dayIndex)
        const classes = cn(
          'relative aspect-square rounded-md border transition-colors duration-fast',
          state === 'done' && 'border-accent bg-accent',
          state === 'miss' && 'border-secondary bg-background-primary',
          state === 'today' && 'border-accent bg-accent-soft ring-1 ring-accent',
          state === 'future' && 'border-tertiary bg-background-tertiary/40',
          hasEntry && 'cursor-pointer hover:opacity-80 focus-visible:outline-none',
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

        return hasEntry ? (
          <button key={d} type="button" title={`Day ${dayIndex} — read note`} onClick={() => onOpen(dayIndex)} className={classes}>
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
