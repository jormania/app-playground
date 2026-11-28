import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, SkipForward } from 'lucide-react'
import { Button, Field, Modal } from '../../ds'
import { hrefOf } from '../app/router'
import { useMatDays } from '../app/state'
import { CompleteSheet } from '../components/Sheets'
import { WeekRing } from '../components/WeekRing'
import { Empty, SectionHead, Thumb } from '../components/ui'
import type { PracticeEntry, SeriesDef, Session } from '../domain/types'
import { allSkips, dayTheme, linkedSessions } from '../lib/series'
import { fold } from '../lib/filter'
import { FEELS, shortTitle } from '../lib/today'
import { cx } from '../../ds/lib/cx'
import { repeatLabel } from '../domain/vocabulary'
import { localDate, summarise, thisWeek } from '../lib/practice'
import s from './screens.module.css'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A month of practice days, shaded by minutes. Weeks start on Monday. */
type Skip = { date: string; def: SeriesDef; day: number }

function PracticeCalendar({ history, skips, today, onPick }: { history: PracticeEntry[]; skips: Skip[]; today: string; onPick: (date: string) => void }) {
  const [offset, setOffset] = useState(0)
  const first = new Date(`${today.slice(0, 7)}-01T12:00:00`)
  first.setMonth(first.getMonth() + offset)
  const minutes = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of history) m.set(h.date, (m.get(h.date) ?? 0) + h.minutes)
    return m
  }, [history])
  const skipDates = useMemo(() => new Set(skips.map((x) => x.date)), [skips])
  const lead = (first.getDay() + 6) % 7
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(first.getFullYear(), first.getMonth(), i + 1, 12)))]
  const monthDays = cells.filter((d): d is string => !!d && minutes.has(d))
  const total = monthDays.reduce((t, d) => t + (minutes.get(d) ?? 0), 0)
  const earliest = history.reduce((m, h) => (h.date < m ? h.date : m), today)
  const canBack = iso(first) > earliest.slice(0, 8) + '01'
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return (
    <div className={s.calendar}>
      <div className={s.spread}>
        <button type="button" className={s.iconBtn} aria-label="Previous month" disabled={!canBack} onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={18} /></button>
        <div className={s.calendarHead}>
          <strong>{label}</strong>
          <span className={s.muted}>{monthDays.length ? `${monthDays.length} ${monthDays.length === 1 ? 'day' : 'days'} · ${total} min` : 'No practice yet'}</span>
        </div>
        <button type="button" className={s.iconBtn} aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}><ChevronRight size={18} /></button>
      </div>
      <div className={s.calendarGrid} role="grid" aria-label={label}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className={s.calendarDow} aria-hidden="true">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />
          const m = minutes.get(d) ?? 0
          const level = m === 0 ? 0 : m < 20 ? 1 : m < 40 ? 2 : 3
          const skippedHere = skipDates.has(d)
          const cls = cx(s.calendarDay, s[`lvl${level}`], d === today && s.calendarToday, skippedHere && (m ? s.calendarAlsoSkip : s.calendarSkip))
          // A practice day, or a day you chose to skip a series day, opens what happened; an empty day stays a plain number.
          return m || skippedHere ? (
            <button key={d} type="button" role="gridcell" className={cls} onClick={() => onPick(d)}
              title={m ? `${m} min${skippedHere ? ' · a series day skipped' : ''}` : 'A series day skipped'}
              aria-label={`${Number(d.slice(8))}, ${m ? `${m} minutes` : 'no practice'}${skippedHere ? ', a series day skipped' : ''}: show the day`}>
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={d} role="gridcell" className={cls} aria-label={String(Number(d.slice(8)))}>{Number(d.slice(8))}</span>
          )
        })}
      </div>
    </div>
  )
}

/** Minutes, how it felt and the repeat rating: the one line every practice shows. */
const entryMeta = (e: PracticeEntry, videoMinutes?: number) =>
  [e.minutes === videoMinutes ? '' : `${e.minutes} min`, e.feel ? `felt ${FEELS.find((f) => f.value === e.feel)?.label.toLowerCase() ?? ''}` : '', e.rating ? repeatLabel(e.rating).toLowerCase() : '']
    .filter(Boolean).join(' · ')

/**
 * One calendar day: what was practised, in the same sheet as a series day (the
 * thumbnail with the length on it, where it comes from, how it went, the note).
 */
function PracticeDaySheet({ date, entries, skips, onEdit, onClose }: {
  date: string
  entries: PracticeEntry[]
  skips: Skip[]
  onEdit: (e: PracticeEntry) => void
  onClose: () => void
}) {
  const { byId, seriesDefs, sessions, seriesProgress } = useMatDays()
  const title = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const minutes = entries.reduce((t, e) => t + e.minutes, 0)
  return (
    <Modal open onClose={onClose} title={title}>
      <div className={s.stack}>
        {entries.length > 1 && <p className={s.muted}>{entries.length} practices · {minutes} min</p>}
        {entries.map((e) => {
          const session = byId.get(e.sessionId)
          const name = session ? shortTitle(session, seriesDefs) : null
          return (
            <div key={e.id} className={s.dayEntry}>
              {session ? (
                <a className={s.dayIntro} href={hrefOf({ name: 'session', id: session.id })} onClick={onClose}>
                  <Thumb session={session} className={s.dayIntroThumb} />
                  {name?.label && <span className={s.entrySource}>{name.label}</span>}
                  <strong className={s.todayTitle}>{name?.title}</strong>
                  {/* The thumbnail already carries the video's length; the minutes show only when they differ. */}
                  <span className={s.dayIntroText}>{entryMeta(e, session.durationMinutes)}</span>
                </a>
              ) : (
                <p className={s.muted}>A removed session · {entryMeta(e)}</p>
              )}
              {e.note && <p className={s.dayNote}>“{e.note}”</p>}
              {session && <button type="button" className={s.textLink} onClick={() => onEdit(e)}>Edit</button>}
            </div>
          )
        })}
        {/* Days skipped on purpose: recorded as a choice, so the day reads as decided, not missed. */}
        {skips.map((x) => {
          const session = linkedSessions(x.def, sessions, seriesProgress[x.def.id]).get(x.day)
          const theme = session ? dayTheme(session.title, x.def) : ''
          return (
            <a key={`${x.def.id}-${x.day}`} className={s.skipRow} href={hrefOf({ name: 'seriesDetail', id: x.def.id })} onClick={onClose}>
              <SkipForward size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>
                <span className={s.entrySource}>Skipped · {x.def.name} · {x.def.unit} {x.day}</span>
                {theme && <span className={s.skipTheme}>{theme}</span>}
              </span>
            </a>
          )
        })}
      </div>
    </Modal>
  )
}

function LogPractice({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: Session) => void }) {
  const { sessions } = useMatDays()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = fold(q.trim())
    return sessions.filter((x) => !t || fold(x.title).includes(t)).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 60)
  }, [sessions, q])
  return (
    <Modal open={open} onClose={onClose} title="Log a practice">
      <Field label="Which session?" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className={s.picker}>
        {list.map((x) => (
          <button key={x.id} type="button" className={s.pick} onClick={() => onPick(x)}>
            <span>{x.title}</span><span className={s.muted}>{x.durationMinutes} min</span>
          </button>
        ))}
        {list.length === 0 && <p className={s.muted}>No session with that title.</p>}
      </div>
    </Modal>
  )
}

export function Practice() {
  const { history, byId, deletePractice, preferences, seriesDefs, seriesProgress } = useMatDays()
  const skips = useMemo(() => allSkips(seriesDefs, seriesProgress), [seriesDefs, seriesProgress])
  const target = preferences.weeklyTargetMinutes
  const [logging, setLogging] = useState(false)
  const [completing, setCompleting] = useState<Session | null>(null)
  const [editing, setEditing] = useState<PracticeEntry | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const today = localDate()

  const total = summarise(history)
  const week = summarise(thisWeek(history, today))

  const months = useMemo(() => {
    const out: { label: string; entries: PracticeEntry[] }[] = []
    for (const e of history) {
      const label = new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      if (out[out.length - 1]?.label !== label) out.push({ label, entries: [] })
      out[out.length - 1].entries.push(e)
    }
    return out
  }, [history])


  const title = (id: string) => { const x = byId.get(id); return x ? shortTitle(x, seriesDefs).title : 'Removed session' }
  /** Where a session comes from: "MOVE · Day 3", or its programme. */
  const source = (id: string) => { const x = byId.get(id); return x ? shortTitle(x, seriesDefs).label : undefined }


  return (
    <>
      <header className={s.pageHead}>
        <div className={s.spread}>
          <div>
            <h1 className={s.pageTitle}>My Practice</h1>
            <p className={s.lede}>Everything you’ve practised, newest first. Tap a shaded day for what you did then, or Edit to change a date, a note or your rating.</p>
          </div>
          <Button variant="outline" onClick={() => setLogging(true)}><Plus size={16} /> Log a practice</Button>
        </div>
      </header>

      {history.length === 0 ? (
        <Empty title="No practices recorded yet">
          <p>After a session, come back to Mat Days and tap Mark as done, or add one here with Log a practice.</p>
        </Empty>
      ) : (
        <>
          <div className={s.stats}>
            <div className={cx(s.stat, s.statRing)}>
              <WeekRing minutes={week.minutes} sessions={week.sessions} target={target} link={false} />
            </div>
            <div className={s.stat}><strong>{total.sessions}</strong><span>Practices</span></div>
            <div className={s.stat}><strong>{Math.round(total.minutes / 6) / 10}</strong><span>Hours on the mat</span></div>
            <div className={s.stat}><strong>{total.days}</strong><span>Practice days</span></div>
          </div>

          <PracticeCalendar history={history} skips={skips} today={today} onPick={setDay} />

          <SectionHead title="History" />
          {months.map((m) => (
            <section key={m.label}>
              <h3 className={s.month}>{m.label}</h3>
              {m.entries.map((e) => {
                const d = new Date(`${e.date}T12:00:00`)
                const session = byId.get(e.sessionId)
                return (
                  <div key={e.id} className={s.entry}>
                    <div className={s.entryDate}><strong>{d.getDate()}</strong><span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span></div>
                    <div>
                      {session && source(session.id) && <span className={s.entrySource}>{source(session.id)}</span>}
                      {session ? <a className={s.entryTitle} href={hrefOf({ name: 'session', id: session.id })}>{title(session.id)}</a> : <span className={s.entryTitle}>Removed session</span>}
                      <div className={s.entryMeta}>{entryMeta(e)}</div>
                      {e.note && <div className={s.dayNote}>“{e.note}”</div>}
                    </div>
                    {session
                      ? <button type="button" className={s.textLink} onClick={() => setEditing(e)}>Edit</button>
                      : <button type="button" className={s.textLink} onClick={() => deletePractice(e.id)}>Delete</button>}
                  </div>
                )
              })}
            </section>
          ))}
        </>
      )}

      {day && <PracticeDaySheet date={day} entries={history.filter((h) => h.date === day)} skips={skips.filter((x) => x.date === day)}
        onEdit={(e) => { setDay(null); setEditing(e) }} onClose={() => setDay(null)} />}
      {logging && <LogPractice open onClose={() => setLogging(false)} onPick={(x) => { setLogging(false); setCompleting(x) }} />}
      {completing && <CompleteSheet open session={completing} onClose={() => setCompleting(null)} />}
      {editing && byId.get(editing.sessionId) && (
        <CompleteSheet key={editing.id} open session={byId.get(editing.sessionId)!} entry={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
