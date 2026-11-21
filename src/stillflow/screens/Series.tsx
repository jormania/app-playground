import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, Flag, Link2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Button, ConfirmModal, Field, Modal, SegmentedControl } from '../../ds'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
import { PracticeLink, StartPractice } from '../components/StartPractice'
import { Empty, SectionHead, Thumb } from '../components/ui'
import type { SeriesDef, SeriesProgress, Session } from '../domain/types'
import { fold } from '../lib/filter'
import { localDate, newEntry } from '../lib/practice'
import {
  customSeries, dayTheme, daySearchUrl, doneDays, finishProgress, linkedSessions, nextDay, pace, startProgress, toggleDay, inRun, runStart, dayOf, belongsTo } from '../lib/series'
import { cx } from '../../ds/lib/cx'
import { repeatLabel } from '../domain/vocabulary'
import { shortTitle } from '../lib/today'
import s from './screens.module.css'

const fmtShort = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Everything a screen needs to know about one series right now. */
export function useSeries(def: SeriesDef) {
  const { sessions, history, seriesProgress } = useStillflow()
  const progress = seriesProgress[def.id] as SeriesProgress | undefined
  return useMemo(() => {
    const linked = linkedSessions(def, sessions, progress)
    const done = doneDays(def, progress, linked, history, sessions)
    const next = nextDay(def, done)
    const p = progress && progress.status === 'active' ? pace(def, { ...progress, startedAt: runStart(progress, done) }, done.size, localDate()) : null
    const started = progress ? runStart(progress, done) : undefined
    return { progress, linked, done, next, pace: p, started }
  }, [def, sessions, history, progress])
}

/**
 * Ticking a day. A day with a session in the library is a practice: it goes
 * into My Practice (and the series counts it from there). A day with no session
 * can only be ticked on the series itself.
 */
export function useDayActions(def: SeriesDef) {
  const { saveProgress, savePractice, deletePractices, history, toast, sessions } = useStillflow()
  const { progress, linked, done } = useSeries(def)
  const mark = (day: number) => {
    if (!progress || progress.status !== 'active') return
    const session = linked.get(day)
    if (session) {
      savePractice(newEntry(session, { date: localDate() }))
    } else {
      saveProgress(toggleDay(progress, day, localDate(), true))
    }
    const left = def.length - done.size - (done.has(day) ? 0 : 1)
    toast(left > 0 ? `${def.unit} ${day} done · ${left} to go${session ? ' · in My Practice too' : ''}` : `Every ${def.unit.toLowerCase()} of ${def.name} done`, 'success')
  }
  const unmark = (day: number) => {
    if (!progress || progress.status !== 'active') return
    if (progress.manualDays[day]) { saveProgress(toggleDay(progress, day, localDate(), false)); return }
    const session = linked.get(day)
    if (!session) return
    // Undo the practices that made this day count in the current run, whichever copy of the day they were.
    const copies = new Set([session.id, ...sessions.filter((x) => dayOf(x) === day && belongsTo(x, def)).map((x) => x.id)])
    const ids = history.filter((e) => copies.has(e.sessionId) && inRun(progress, e.date)).map((e) => e.id)
    deletePractices(ids, ids.length > 1 ? `${def.unit} ${day} unticked: ${ids.length} practices removed` : `${def.unit} ${day} unticked`)
  }
  return { mark, unmark }
}

/**
 * The closing page of a finished run: when it ran, how much time it held, the
 * days you'd most like to return to and what you wrote along the way.
 */
function JourneySummary({ def }: { def: SeriesDef }) {
  const { history, sessions } = useStillflow()
  const { progress, linked, done, started } = useSeries(def)
  if (!progress || progress.status !== 'completed') return null
  const from = started ?? progress.startedAt
  const to = progress.endedAt ?? localDate()
  // Every copy of a day counts, as it does for ticking the day off.
  const dayOfSession = new Map([...linked].map(([d, x]) => [x.id, d]))
  for (const x of sessions) { const d = dayOf(x); if (d && d <= def.length && !dayOfSession.has(x.id) && belongsTo(x, def)) dayOfSession.set(x.id, d) }
  const entries = history.filter((h) => dayOfSession.has(h.sessionId) && inRun(progress, h.date) && h.date <= to)
  const minutes = entries.reduce((m, h) => m + h.minutes, 0)
  const loved = [...new Map(entries.filter((h) => (h.rating ?? 0) >= 4).map((h) => [h.sessionId, h])).values()]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 4)
  const notes = entries.filter((h) => h.note).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const name = (id: string) => {
    const d = dayOfSession.get(id)!
    const x = linked.get(d)
    const theme = x ? dayTheme(x.title, def) : ''
    return theme ? `${def.unit} ${d} · ${theme}` : `${def.unit} ${d}`
  }
  return (
    <section className={s.summary} aria-label={`${def.name} completed`}>
      <span className={s.journeyKicker}>Journey complete</span>
      <h2 className={s.summaryTitle}>{done.size} of {def.length} {def.unit.toLowerCase()}s, {fmt(from)} to {fmt(to)}</h2>
      <p className={s.muted}>{minutes ? `${Math.round(minutes / 6) / 10} hours on the mat across ${entries.length} practices.` : 'Ticked off on the series.'}</p>
      {loved.length > 0 && (
        <div>
          <h3 className={s.summaryHead}>Days you’d return to</h3>
          {loved.map((h) => <p key={h.sessionId} className={s.summaryRow}>{name(h.sessionId)} <span className={s.muted}>· {repeatLabel(h.rating).toLowerCase()}</span></p>)}
        </div>
      )}
      {notes.length > 0 && (
        <div>
          <h3 className={s.summaryHead}>What you wrote</h3>
          {notes.map((h) => <p key={h.id} className={s.summaryNote}>“{h.note}” <span className={s.muted}>· {name(h.sessionId)}</span></p>)}
        </div>
      )}
    </section>
  )
}

function kindLabel(def: SeriesDef) {
  if (def.kind === 'custom') return `Your series · ${def.length} ${def.unit.toLowerCase()}s`
  return `${def.year ?? ''} · ${def.length} ${def.unit.toLowerCase()}s`.replace(/^ · /, '')
}

/** A quiet progress ring: the fraction done, with the count in its middle. */
function Ring({ value, max }: { value: number; max: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const frac = max ? Math.min(1, value / max) : 0
  return (
    <span className={s.ring} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${value} of ${max} done`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className={s.ringTrack} />
        {frac > 0 && <circle cx="36" cy="36" r={r} className={s.ringFill} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 36 36)" />}
      </svg>
      <span className={s.ringLabel}><strong>{value}</strong><small>/{max}</small></span>
    </span>
  )
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
        <span className={s.muted}>Abandoned after {progress?.runs.at(-1)?.daysDone ?? done.size} of {def.length}</span>
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
            <h1 className={s.pageTitle}>Series</h1>
            <p className={s.lede}>Adriene’s 30-day journeys and shorter series. Start one and Stillflow keeps your place, one day at a time.</p>
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
  const { saveProgress, markLaunched, seriesDefs } = useStillflow()
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
          <a className={s.todayPick} href={hrefOf({ name: 'session', id: session.id })} onClick={onClose}>
            <Thumb session={session} className={s.todayThumb} />
            <span>
              <strong className={s.todayTitle}>{dayTheme(session.title, def) || shortTitle(session, seriesDefs).title}</strong>
              {session.styles[0] && <span className={s.muted}>{session.styles[0]}</span>}
            </span>
          </a>
        ) : (
          <p className={s.muted}>This {def.unit.toLowerCase()}’s video isn’t in your library yet. Find it on YouTube, or link a session you’ve already added.</p>
        )}
        {/* Start leads; ticking it off is a small tag beside it, not a second big button. */}
        <div className={s.dayActions}>
          {session
            ? <StartPractice session={session} series={{ seriesId: def.id, day }} label={`Start ${label}`} />
            : <PracticeLink url={daySearchUrl(def, day)} search label={`Find ${label} on YouTube`} onLaunch={() => markLaunched({ seriesId: def.id, day })} />}
          {active && (isDone
            ? <button type="button" className={cx(s.dayTag, s.dayTagOn)} aria-label={`Untick ${label}, done ${fmt(done.get(day)!)}`}
                title="Tap to untick" onClick={() => { unmark(day); onClose() }}><Check size={14} strokeWidth={2.4} /> Done {fmtShort(done.get(day)!)}</button>
            : <button type="button" className={s.dayTag} aria-label={`Mark ${label} done`}
                title={session ? 'Also recorded in My Practice, dated today' : 'Ticked on the series only'} onClick={() => { mark(day); onClose() }}><Check size={14} strokeWidth={2.4} /> Mark done</button>)}
        </div>
        {!active && <p className={s.muted}>Start the series to tick {def.unit.toLowerCase()}s off.</p>}
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
  const { progress, linked, done, next, pace: p, started } = useSeries(def)
  const { mark } = useDayActions(def)
  const [day, setDay] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<null | 'abandon' | 'complete' | 'restart' | 'delete'>(null)
  const today = localDate()
  const status = progress?.status === 'idle' ? undefined : progress?.status
  const unit = def.unit.toLowerCase()
  const nextSession = next ? linked.get(next) : undefined
  // A finished run is described above the days already; Earlier runs lists the ones before it.
  const earlier = progress ? (status === 'completed' || status === 'abandoned' ? progress.runs.slice(0, -1) : progress.runs) : []

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

      {status === 'completed' && <JourneySummary def={def} />}

      {status === 'active' ? (
        <section className={s.journey} aria-label="Where you are">
          <div className={s.journeyTop}>
            <Ring value={done.size} max={def.length} />
            <div className={s.journeyHead}>
              <span className={s.journeyKicker}>{done.size >= def.length ? 'Every practice done' : `${done.size} of ${def.length} ${unit}s done`}</span>
              <span className={s.journeyStarted}>Started {fmt(started ?? progress!.startedAt)}</span>
              {p && done.size < def.length && <span className={cx(s.pacePill, p.delta < 0 && s.paceBehind)}>{p.label}</span>}
            </div>
          </div>

          {next ? (
            <section className={s.upNext} aria-label={`Up next: ${def.unit} ${next}`}>
              <span className={s.upNextLabel}>Up next</span>
              <div className={nextSession ? s.upNextPick : undefined}>
                {nextSession && <a href={hrefOf({ name: 'session', id: nextSession.id })}><Thumb session={nextSession} className={s.todayThumb} /></a>}
                <div className={s.upNextText}>
                  <div className={s.upNextTitle}>
                    <span className={s.upNextDay}>{def.unit} {next}</span>
                    {nextSession && dayTheme(nextSession.title, def) && <span className={s.upNextTheme}>{dayTheme(nextSession.title, def)}</span>}
                  </div>
                  {(!nextSession || nextSession.styles[0]) && (
                    <span className={s.upNextMeta}>{nextSession ? nextSession.styles[0] : 'Not in your library yet: opens a YouTube search'}</span>
                  )}
                </div>
              </div>
              <div className={s.upNextActions}>
                {nextSession
                  ? <StartPractice session={nextSession} series={{ seriesId: def.id, day: next }} label="Start" />
                  : <PracticeLink url={daySearchUrl(def, next)} search label="Find on YouTube" ariaLabel={`Find ${def.unit} ${next} on YouTube`} onLaunch={() => markLaunched({ seriesId: def.id, day: next })} />}
                <button type="button" className={s.markDone} aria-label={`Mark ${def.unit} ${next} done`} onClick={() => mark(next)}><Check size={17} strokeWidth={2} /> Mark done</button>
              </div>
            </section>
          ) : (
            <div className={s.upNext}>
              <span className={s.upNextLabel}>Well practised</span>
              <span className={s.upNextMeta}>All {def.length} {unit}s are done. Complete the series to file it under your finished runs.</span>
              <div className={s.upNextActions}><Button onClick={() => setConfirm('complete')}><Flag size={16} /> Complete series</Button></div>
            </div>
          )}

          <div className={s.journeyFoot}>
            {next && <button type="button" className={s.footBtn} onClick={() => setConfirm('complete')}><Flag size={14} /> Complete early</button>}
            <button type="button" className={cx(s.footBtn, s.footQuiet)} onClick={() => setConfirm('abandon')}><X size={14} /> Abandon</button>
          </div>
        </section>
      ) : (
        <section className={s.seq}>
          {status === 'abandoned' && progress!.runs.length > 0 && <p>Abandoned {fmt(progress!.endedAt!)} after {progress!.runs.at(-1)?.daysDone} of {def.length}. Nothing is lost; begin again any time.</p>}
          <div className={s.row}>
            <Button onClick={status ? () => setConfirm('restart') : start}>{status ? <><RotateCcw size={15} /> Start again</> : `Start ${def.name}`}</Button>
            {!status && <span className={s.muted}>Stillflow keeps your place, one {unit} at a time.</span>}
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
              <span className={s.dayNum}>{d}</span>
              {linkedSession && <span className={s.dayTheme}>{dayTheme(linkedSession.title, def) || `${linkedSession.durationMinutes} min`}</span>}
              {done.has(d) && <Check size={12} strokeWidth={2.4} />}
            </button>
          )
        })}
      </div>
      <p className={s.entryMeta} style={{ marginTop: 'var(--space-sm)' }}>Tap any {unit} to start it or tick it off. A dashed outline means its video isn’t in your library yet.</p>

      {earlier.length > 0 && (
        <>
          <SectionHead title="Earlier runs" />
          {[...earlier].reverse().map((r, i) => (
            <p key={i} className={s.muted}>{fmt(r.startedAt)} – {fmt(r.endedAt)} · {r.status === 'completed' ? 'completed' : 'abandoned'} · {r.daysDone} of {def.length}</p>
          ))}
        </>
      )}

      {def.kind === 'custom' && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <Button variant="ghost" onClick={() => setConfirm('delete')}><Trash2 size={15} /> Delete this series</Button>
        </div>
      )}

      {day != null && <DaySheet def={def} day={day} onClose={() => setDay(null)} />}
      <ConfirmModal isOpen={confirm === 'abandon'} title={`Abandon ${def.name}?`} variant="danger" confirmText="Abandon"
        message={`You’ve done ${done.size} of ${def.length}. The run is kept in Earlier runs, and you can start again whenever you like.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { saveProgress(finishProgress(progress!, 'abandoned', today, done.size)); setConfirm(null); toast(`${def.name} abandoned`) }} />
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
