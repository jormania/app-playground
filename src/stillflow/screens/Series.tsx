import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, Flag, Link2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Button, ConfirmModal, Field, Modal, SegmentedControl } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { PracticeLink, StartPractice } from '../components/StartPractice'
import { Empty, SectionHead } from '../components/ui'
import type { SeriesDef, SeriesProgress, Session } from '../domain/types'
import { fold } from '../lib/filter'
import { localDate, newEntry } from '../lib/practice'
import {
  customSeries, daySearchUrl, doneDays, finishProgress, linkedSessions, nextDay, pace, startProgress, toggleDay,
} from '../lib/series'
import { cx } from '../../ds/lib/cx'
import s from './screens.module.css'

const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Everything a screen needs to know about one series right now. */
export function useSeries(def: SeriesDef) {
  const { sessions, history, seriesProgress } = useStillflow()
  const progress = seriesProgress[def.id] as SeriesProgress | undefined
  return useMemo(() => {
    const linked = linkedSessions(def, sessions, progress)
    const done = doneDays(def, progress, linked, history)
    const next = nextDay(def, done)
    const p = progress && progress.status === 'active' ? pace(def, progress, done.size, localDate()) : null
    return { progress, linked, done, next, pace: p }
  }, [def, sessions, history, progress])
}

/**
 * Ticking a day. A day with a session in the library is a practice: it goes
 * into My Practice (and the series counts it from there). A day with no session
 * can only be ticked on the series itself.
 */
export function useDayActions(def: SeriesDef) {
  const { saveProgress, savePractice, deletePractice, history, toast } = useStillflow()
  const { progress, linked } = useSeries(def)
  const mark = (day: number) => {
    if (!progress || progress.status !== 'active') return
    const session = linked.get(day)
    if (session) {
      savePractice(newEntry(session, { date: localDate() }))
      toast(`${def.unit} ${day} recorded in My Practice`, 'success')
    } else {
      saveProgress(toggleDay(progress, day, localDate(), true))
    }
  }
  const unmark = (day: number) => {
    if (!progress || progress.status !== 'active') return
    if (progress.manualDays[day]) { saveProgress(toggleDay(progress, day, localDate(), false)); return }
    const session = linked.get(day)
    if (!session) return
    // Undo the practice that made this day count in the current run.
    for (const h of history.filter((e) => e.sessionId === session.id && e.date >= progress.startedAt)) deletePractice(h.id)
  }
  return { mark, unmark }
}

function kindLabel(def: SeriesDef) {
  if (def.kind === 'custom') return `Your series · ${def.length} ${def.unit.toLowerCase()}s`
  return `${def.year ?? ''} · ${def.length} ${def.unit.toLowerCase()}s`.replace(/^ · /, '')
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className={s.seriesBar} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${value} of ${max} done`}>
      <span style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  )
}

function SeriesCard({ def }: { def: SeriesDef }) {
  const { progress, done, linked, next, pace: p } = useSeries(def)
  const status = progress?.status
  return (
    <a href={hrefOf({ name: 'seriesDetail', id: def.id })} className={cx(s.collection, status === 'active' && s.seriesActive)}>
      <span className={s.kicker} style={{ margin: 0 }}>{kindLabel(def)}</span>
      <h3>{def.name}</h3>
      {status === 'active' ? (
        <>
          <Bar value={done.size} max={def.length} />
          <span className={s.muted}>{done.size} of {def.length} done{next ? ` · next: ${def.unit} ${next}` : ''}</span>
          {p && <span className={s.paceNote}>{p.label}</span>}
        </>
      ) : status === 'completed' ? (
        <span className={s.muted}><Check size={14} style={{ verticalAlign: '-2px' }} /> Completed {progress?.endedAt ? fmt(progress.endedAt) : ''}</span>
      ) : status === 'abandoned' ? (
        <span className={s.muted}>Set aside after {progress?.runs.at(-1)?.daysDone ?? done.size} of {def.length}</span>
      ) : (
        <span className={s.muted}>{def.blurb ?? 'Not started'}</span>
      )}
      {linked.size > 0 && <span className={s.entryMeta}>{linked.size} of {def.length} in your library</span>}
    </a>
  )
}

function CreateSeries({ onClose }: { onClose: () => void }) {
  const { saveSeriesDef, preferences } = useStillflow()
  const [name, setName] = useState('')
  const [length, setLength] = useState('7')
  const [unit, setUnit] = useState<'Day' | 'Week'>('Day')
  const n = Number(length)
  const valid = name.trim() && Number.isInteger(n) && n >= 1 && n <= 90
  return (
    <Modal open onClose={onClose} title="Create a series">
      <form className={s.stack} onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const def = customSeries(name, n, unit, preferences.defaultInstructor || 'Yoga With Adriene')
        saveSeriesDef(def)
        onClose()
        navigate({ name: 'seriesDetail', id: def.id })
      }}>
        <p className={s.muted}>For a programme Stillflow doesn’t list, or a sequence of your own. Sessions whose series field matches the name join it by day number.</p>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yoga for Weight Loss" autoFocus />
        <div className={s.twoCol}>
          <Field label="Number of practices" type="number" inputMode="numeric" min={1} max={90} value={length} onChange={(e) => setLength(e.target.value)} />
          <SegmentedControl label="One per" value={unit} onChange={(v) => setUnit(v as 'Day' | 'Week')} options={[{ value: 'Day', label: 'Day' }, { value: 'Week', label: 'Week' }]} />
        </div>
        <div className={s.row} style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!valid}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

export function SeriesList() {
  const { seriesDefs, seriesProgress } = useStillflow()
  const [creating, setCreating] = useState(false)
  const active = seriesDefs.filter((d) => seriesProgress[d.id]?.status === 'active')
  const rest = seriesDefs.filter((d) => seriesProgress[d.id]?.status !== 'active')
  const groups: [string, SeriesDef[]][] = [
    ['January journeys', rest.filter((d) => d.kind === 'journey')],
    ['Shorter series', rest.filter((d) => d.kind === 'short')],
    ['Your series', rest.filter((d) => d.kind === 'custom')],
  ]
  return (
    <>
      <header className={s.pageHead}>
        <div className={s.spread}>
          <div>
            <p className={s.kicker}>Series</p>
            <h1 className={s.pageTitle}>One practice at a time</h1>
            <p className={s.lede}>Adriene’s journeys and shorter series. Start one, follow it day by day, and set it aside or finish it when you choose.</p>
          </div>
          <Button variant="outline" onClick={() => setCreating(true)}><Plus size={16} /> Create a series</Button>
        </div>
      </header>

      {active.length > 0 && (
        <>
          <SectionHead title="In progress" />
          <div className={s.collections}>{active.map((d) => <SeriesCard key={d.id} def={d} />)}</div>
        </>
      )}
      {groups.map(([title, defs]) => defs.length > 0 && (
        <section key={title}>
          <SectionHead title={title} />
          <div className={s.collections}>{defs.map((d) => <SeriesCard key={d.id} def={d} />)}</div>
        </section>
      ))}
      {creating && <CreateSeries onClose={() => setCreating(false)} />}
    </>
  )
}

function SessionPicker({ onPick, onClose, def, day }: { onPick: (s: Session) => void; onClose: () => void; def: SeriesDef; day: number }) {
  const { sessions } = useStillflow()
  const [q, setQ] = useState(def.name)
  const list = useMemo(() => {
    const t = fold(q.trim())
    return sessions.filter((x) => !t || fold(`${x.title} ${x.series ?? ''}`).includes(t)).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 60)
  }, [sessions, q])
  return (
    <Modal open onClose={onClose} title={`Link ${def.unit} ${day}`}>
      <Field label="Find the session in your library" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className={s.picker}>
        {list.map((x) => (
          <button key={x.id} type="button" className={s.pick} onClick={() => onPick(x)}>
            <span>{x.title}</span><span className={s.muted}>{x.durationMinutes} min</span>
          </button>
        ))}
        {list.length === 0 && <p className={s.muted}>Nothing matches. Add the video from Settings first, then link it here.</p>}
      </div>
    </Modal>
  )
}

function DaySheet({ def, day, onClose }: { def: SeriesDef; day: number; onClose: () => void }) {
  const { saveProgress, markLaunched } = useStillflow()
  const { progress, linked, done } = useSeries(def)
  const { mark, unmark } = useDayActions(def)
  const [picking, setPicking] = useState(false)
  const session = linked.get(day)
  const isDone = done.has(day)
  const active = progress?.status === 'active'
  const label = `${def.unit} ${day}`

  const setLink = (sessionId: string | null) => {
    const base: SeriesProgress = progress ?? { seriesId: def.id, status: 'idle', startedAt: localDate(), manualDays: {}, links: {}, runs: [] }
    const links = { ...base.links }
    if (sessionId) links[day] = sessionId
    else delete links[day]
    saveProgress({ ...base, links })
  }

  return (
    <Modal open onClose={onClose} title={`${def.name} · ${label}`}>
      <div className={s.stack}>
        {session ? (
          <div className={s.panel} style={{ padding: 'var(--space-md)' }}>
            <a className={s.entryTitle} href={hrefOf({ name: 'session', id: session.id })} onClick={onClose}>{session.title}</a>
            <div className={s.entryMeta}>{session.durationMinutes} min{session.styles[0] ? ` · ${session.styles[0]}` : ''}</div>
          </div>
        ) : (
          <p className={s.muted}>This {def.unit.toLowerCase()} isn’t in your library yet, so Stillflow can’t say what it holds. Find it on YouTube, or link a session you’ve added.</p>
        )}
        <div className={s.row}>
          {session
            ? <StartPractice session={session} series={{ seriesId: def.id, day }} label={`Start ${label}`} />
            : <PracticeLink url={daySearchUrl(def, day)} search label={`Find ${label} on YouTube`} onLaunch={() => markLaunched({ seriesId: def.id, day })} />}
        </div>
        {active ? (
          <>
            <Button variant={isDone ? 'secondary' : 'primary'} onClick={() => { if (isDone) unmark(day); else mark(day); onClose() }}>
              {isDone ? `Untick ${label} (done ${fmt(done.get(day)!)})` : `Mark ${label} done`}
            </Button>
            {!isDone && <p className={s.entryMeta}>{session ? 'Recorded in My Practice too, with today’s date. You can change the date there.' : 'Not in your library, so it’s ticked on the series only.'}</p>}
          </>
        ) : (
          <p className={s.muted}>Start the series to tick off {def.unit.toLowerCase()}s.</p>
        )}
        <div className={s.row} style={{ justifyContent: 'space-between' }}>
          <button type="button" className={s.textLink} onClick={() => setPicking(true)}><Link2 size={14} style={{ verticalAlign: '-2px' }} /> {session ? 'Link a different session' : 'Link a session'}</button>
          {progress?.links[day] && <button type="button" className={s.textLink} onClick={() => setLink(null)}>Unlink</button>}
        </div>
      </div>
      {picking && <SessionPicker def={def} day={day} onClose={() => setPicking(false)} onPick={(x) => { setLink(x.id); setPicking(false) }} />}
    </Modal>
  )
}

export function SeriesDetail({ id }: { id: string }) {
  const { seriesDefs, saveProgress, deleteSeriesDef, toast, ready, markLaunched } = useStillflow()
  const def = seriesDefs.find((d) => d.id === id)
  if (!def) return ready ? <Empty title="Series not found"><a className={s.textLink} href="#/series">All series</a></Empty> : null
  return <SeriesDetailInner def={def} saveProgress={saveProgress} deleteSeriesDef={deleteSeriesDef} toast={toast} markLaunched={markLaunched} />
}

function SeriesDetailInner({ def, saveProgress, deleteSeriesDef, toast, markLaunched }: {
  def: SeriesDef
  saveProgress: (p: SeriesProgress) => void
  deleteSeriesDef: (id: string) => void
  toast: (m: string, t?: 'success' | 'neutral' | 'danger') => void
  markLaunched: (l: { seriesId?: string; day?: number; sessionId?: string }) => void
}) {
  const { progress, linked, done, next, pace: p } = useSeries(def)
  const { mark } = useDayActions(def)
  const [day, setDay] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<null | 'abandon' | 'complete' | 'restart' | 'delete'>(null)
  const today = localDate()
  const status = progress?.status === 'idle' ? undefined : progress?.status
  const unit = def.unit.toLowerCase()
  const nextSession = next ? linked.get(next) : undefined

  const start = () => {
    // No toast: the panel itself changes to show Day 1.
    saveProgress(startProgress(def, today, progress, done.size))
  }

  return (
    <>
      <a className={s.back} href="#/series"><ArrowLeft size={16} /> Series</a>
      <header className={s.pageHead}>
        <p className={s.kicker}>{kindLabel(def)}</p>
        <h1 className={s.pageTitle}>{def.name}</h1>
        {def.blurb && <p className={s.lede}>{def.blurb}</p>}
        <div className={s.row} style={{ marginTop: 'var(--space-sm)' }}>
          {def.sourceUrl && <a className={s.textLink} href={def.sourceUrl} target="_blank" rel="noopener noreferrer">About this series <ExternalLink size={12} /></a>}
          <span className={s.entryMeta}>{linked.size} of {def.length} {unit}s in your library</span>
        </div>
      </header>

      {status === 'active' ? (
        <section className={s.seq} aria-label="Where you are">
          <div className={s.spread}>
            <span className={s.kicker} style={{ margin: 0 }}>Started {fmt(progress!.startedAt)}</span>
            {p && <span className={s.paceNote}>{p.label}</span>}
          </div>
          <Bar value={done.size} max={def.length} />
          <strong style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem' }}>
            {next ? `Next: ${def.unit} ${next}${nextSession ? ` · ${nextSession.title}` : ''}` : `All ${def.length} ${unit}s done`}
          </strong>
          <div className={s.row}>
            {next && (nextSession
              ? <StartPractice session={nextSession} series={{ seriesId: def.id, day: next }} label={`Start ${def.unit} ${next}`} compact />
              : <PracticeLink url={daySearchUrl(def, next)} compact search label={`Find ${def.unit} ${next} on YouTube`} onLaunch={() => markLaunched({ seriesId: def.id, day: next })} />)}
            {next && <Button size="sm" variant="ghost" onClick={() => mark(next)}><Check size={15} /> Mark {def.unit} {next} done</Button>}
          </div>
          <div className={s.row} style={{ justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
            <button type="button" className={s.textLink} onClick={() => setConfirm('complete')}><Flag size={13} style={{ verticalAlign: '-2px' }} /> Complete series</button>
            <button type="button" className={s.textLink} style={{ color: 'var(--color-muted)' }} onClick={() => setConfirm('abandon')}><X size={13} style={{ verticalAlign: '-2px' }} /> Abandon</button>
          </div>
        </section>
      ) : (
        <section className={s.seq}>
          {status === 'completed' && <p><Check size={15} style={{ verticalAlign: '-2px' }} /> Completed {fmt(progress!.endedAt!)}, {progress!.runs.at(-1)?.daysDone ?? done.size} of {def.length} {unit}s.</p>}
          {status === 'abandoned' && progress!.runs.length > 0 && <p>Set aside {fmt(progress!.endedAt!)} after {progress!.runs.at(-1)?.daysDone} of {def.length}. Nothing is lost; begin again any time.</p>}
          <div className={s.row}>
            <Button onClick={status ? () => setConfirm('restart') : start}>{status ? <><RotateCcw size={15} /> Start again</> : `Start ${def.name}`}</Button>
            {!status && <span className={s.muted}>One {unit} at a time; Stillflow keeps your place.</span>}
          </div>
        </section>
      )}

      <SectionHead title={`${def.unit}s`} />
      <div className={s.dayGrid}>
        {Array.from({ length: def.length }, (_, i) => i + 1).map((d) => {
          const linkedSession = linked.get(d)
          return (
            <button key={d} type="button" onClick={() => setDay(d)}
              className={cx(s.dayTile, done.has(d) && s.dayDone, status === 'active' && d === next && s.dayNext, !linkedSession && s.dayUnlinked)}
              aria-label={`${def.unit} ${d}${done.has(d) ? ', done' : ''}${d === next && status === 'active' ? ', next' : ''}${linkedSession ? `, ${linkedSession.title}` : ', not in library'}`}>
              <span>{d}</span>
              {done.has(d) && <Check size={12} strokeWidth={2.4} />}
            </button>
          )
        })}
      </div>
      <p className={s.entryMeta} style={{ marginTop: 'var(--space-sm)' }}>Dashed: not in your library yet. Tap any {unit} to open it, tick it, or link a session.</p>

      {progress && progress.runs.length > 0 && (
        <>
          <SectionHead title="Earlier runs" />
          {[...progress.runs].reverse().map((r, i) => (
            <p key={i} className={s.muted}>{fmt(r.startedAt)} – {fmt(r.endedAt)} · {r.status === 'completed' ? 'completed' : 'set aside'} · {r.daysDone} of {def.length}</p>
          ))}
        </>
      )}

      {def.kind === 'custom' && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <Button variant="ghost" onClick={() => setConfirm('delete')}><Trash2 size={15} /> Delete this series</Button>
        </div>
      )}

      {day != null && <DaySheet def={def} day={day} onClose={() => setDay(null)} />}
      <ConfirmModal isOpen={confirm === 'abandon'} title={`Set ${def.name} aside?`} variant="danger" confirmText="Abandon"
        message={`You’ve done ${done.size} of ${def.length}. The run is kept in Earlier runs, and you can start again whenever you like.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { saveProgress(finishProgress(progress!, 'abandoned', today, done.size)); setConfirm(null); toast(`${def.name} set aside`) }} />
      <ConfirmModal isOpen={confirm === 'complete'} title={`Complete ${def.name}?`} confirmText="Complete"
        message={done.size >= def.length ? `All ${def.length} ${unit}s done. Well practised.` : `${done.size} of ${def.length} ${unit}s are ticked. Finishing now records the series as completed as it stands.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { saveProgress(finishProgress(progress!, 'completed', today, done.size)); setConfirm(null); toast(`${def.name} completed`, 'success') }} />
      <ConfirmModal isOpen={confirm === 'restart'} title={`Start ${def.name} again?`} confirmText="Start again"
        message="A fresh run begins today. Your earlier runs stay listed, and practice history isn’t touched."
        onCancel={() => setConfirm(null)} onConfirm={() => { start(); setConfirm(null) }} />
      <ConfirmModal isOpen={confirm === 'delete'} title={`Delete ${def.name}?`} variant="danger" confirmText="Delete"
        message="The series and your progress through it are removed. Sessions and practice history stay."
        onCancel={() => setConfirm(null)} onConfirm={() => { deleteSeriesDef(def.id); setConfirm(null); navigate({ name: 'series' }, { replace: true }) }} />
    </>
  )
}
