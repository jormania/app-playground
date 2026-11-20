import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Field, Modal } from '../../ds'
import { hrefOf } from '../app/router'
import { useStillflow } from '../app/state'
import { CompleteSheet } from '../components/Sheets'
import { Empty, SectionHead } from '../components/ui'
import type { PracticeEntry, Session } from '../domain/types'
import { fold } from '../lib/filter'
import { repeatLabel } from '../domain/vocabulary'
import { localDate, summarise, thisWeek, topValues } from '../lib/practice'
import { daysBetween } from '../lib/recommend'
import s from './screens.module.css'

function Leanings({ title, rows }: { title: string; rows: { value: string; count: number }[] }) {
  if (!rows.length) return null
  const max = rows[0].count
  return (
    <div className={s.panel}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>{title}</h3>
      <div className={s.leanings}>
        {rows.map((r) => (
          <div key={r.value} className={s.lean}>
            <span>{r.value}</span>
            <span className={s.leanBar}><span style={{ width: `${(r.count / max) * 100}%` }} /></span>
            <span className={s.muted} style={{ textAlign: 'right' }}>{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogPractice({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: Session) => void }) {
  const { sessions } = useStillflow()
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
  const { history, sessions, byId, userData, lastPractised, deletePractice, preferences } = useStillflow()
  const target = preferences.weeklyTargetMinutes
  const [logging, setLogging] = useState(false)
  const [completing, setCompleting] = useState<Session | null>(null)
  const [editing, setEditing] = useState<PracticeEntry | null>(null)
  const today = localDate()

  const total = summarise(history)
  const week = summarise(thisWeek(history, today))
  const recent30 = history.filter((h) => daysBetween(h.date, today) <= 30)

  const months = useMemo(() => {
    const out: { label: string; entries: PracticeEntry[] }[] = []
    for (const e of history) {
      const label = new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      if (out[out.length - 1]?.label !== label) out.push({ label, entries: [] })
      out[out.length - 1].entries.push(e)
    }
    return out
  }, [history])

  const notRevisited = sessions
    .filter((x) => (lastPractised[x.id] && daysBetween(lastPractised[x.id], today) > 30) || (userData[x.id]?.favourite && !lastPractised[x.id]))
    .sort((a, b) => (lastPractised[a.id] ?? '').localeCompare(lastPractised[b.id] ?? ''))
    .slice(0, 5)

  const longest = useMemo(() => [...history].sort((a, b) => b.minutes - a.minutes).slice(0, 3), [history])

  return (
    <>
      <header className={s.pageHead}>
        <div className={s.spread}>
          <div>
            <h1 className={s.pageTitle}>My practice</h1>
            <p className={s.lede}>Everything you’ve practised, newest first. Tap Edit to change a date, a note or your rating.</p>
          </div>
          <Button variant="outline" onClick={() => setLogging(true)}><Plus size={16} /> Log a practice</Button>
        </div>
      </header>

      {history.length === 0 ? (
        <Empty title="No practices recorded yet">
          <p>After a session, come back to Stillflow and tap Mark as completed, or add one here with Log a practice.</p>
        </Empty>
      ) : (
        <>
          <div className={s.stats}>
            <div className={s.stat}>
              <strong>{week.minutes}</strong>
              <span>{target ? `of ${target} min this week` : 'Minutes this week'}</span>
              {target ? <span className={s.weekBar} style={{ display: 'block', maxWidth: 'none', marginTop: 8 }}><span style={{ width: `${Math.min(100, (week.minutes / target) * 100)}%` }} /></span> : null}
            </div>
            <div className={s.stat}><strong>{total.sessions}</strong><span>Practices</span></div>
            <div className={s.stat}><strong>{Math.round(total.minutes / 6) / 10}</strong><span>Hours on the mat</span></div>
            <div className={s.stat}><strong>{total.days}</strong><span>Practice days</span></div>
          </div>

          <SectionHead title="Last 30 days" />
          <div className={s.collections}>
            <Leanings title="Styles" rows={topValues(recent30, sessions, (x) => x.styles, 4)} />
            <Leanings title="Body areas" rows={topValues(recent30, sessions, (x) => x.physicalFocus, 4)} />
          </div>
          {recent30.length === 0 && <p className={s.muted}>Nothing in the last 30 days.</p>}

          {(notRevisited.length > 0 || longest.length > 0) && (
            <div className={s.collections} style={{ marginTop: 'var(--space-md)' }}>
              {notRevisited.length > 0 && (
                <div className={s.panel}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Not revisited lately</h3>
                  {notRevisited.map((x) => (
                    <p key={x.id} className={s.muted}><a className={s.entryTitle} href={hrefOf({ name: 'session', id: x.id })}>{x.title}</a>{lastPractised[x.id] ? ` · ${daysBetween(lastPractised[x.id], today)} days ago` : ' · favourite, never logged'}</p>
                  ))}
                </div>
              )}
              <div className={s.panel}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-sm)' }}>Longest sessions</h3>
                {longest.map((e) => (
                  <p key={e.id} className={s.muted}><a className={s.entryTitle} href={hrefOf({ name: 'session', id: e.sessionId })}>{byId.get(e.sessionId)?.title ?? 'Removed session'}</a> · {e.minutes} min</p>
                ))}
              </div>
            </div>
          )}

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
                      {session ? <a className={s.entryTitle} href={hrefOf({ name: 'session', id: session.id })}>{session.title}</a> : <span className={s.entryTitle}>Removed session</span>}
                      <div className={s.entryMeta}>{e.minutes} min{e.rating ? ` · ${repeatLabel(e.rating).toLowerCase()}` : ''}{e.note ? ` · ${e.note}` : ''}</div>
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

      {logging && <LogPractice open onClose={() => setLogging(false)} onPick={(x) => { setLogging(false); setCompleting(x) }} />}
      {completing && <CompleteSheet open session={completing} onClose={() => setCompleting(null)} />}
      {editing && byId.get(editing.sessionId) && (
        <CompleteSheet key={editing.id} open session={byId.get(editing.sessionId)!} entry={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
