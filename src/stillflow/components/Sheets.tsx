import { useEffect, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { Button, Field, Modal, TextAreaField } from '../../ds'
import { ModalFooter } from '../../ds/components/ModalFooter'
import type { PracticeEntry, Session } from '../domain/types'
import { useStillflow } from '../app/state'
import { localDate, newEntry, summarise, thisWeek } from '../lib/practice'
import { doneDays, linkedSessions, seriesOfSession } from '../lib/series'
import { FEELS, GOOD_FOR_AREAS, GOOD_FOR_GOALS, learnFromPractice, shortTitle } from '../lib/today'
import { WeekRing } from './WeekRing'
import { Chip, RepeatRating } from './ui'
import styles from './Sheets.module.css'

/** How a series stands once this practice is in, for the finish moment. */
function seriesLine(session: Session, entry: PracticeEntry, state: ReturnType<typeof useStillflow>): string | null {
  for (const { def } of seriesOfSession(session, state.seriesDefs, state.seriesProgress)) {
    const progress = state.seriesProgress[def.id]
    if (progress?.status !== 'active') continue
    const linked = linkedSessions(def, state.sessions, progress)
    const done = doneDays(def, progress, linked, [entry, ...state.history.filter((h) => h.id !== entry.id)])
    const day = [...linked].find(([, x]) => x.id === session.id)?.[0]
    if (!day || !done.has(day)) continue
    const left = def.length - done.size
    return left > 0 ? `${def.name} · ${def.unit} ${day} done, ${left} to go` : `${def.name} · every ${def.unit.toLowerCase()} done`
  }
  return null
}

function nth(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** A short pause after recording: the week's ring fills, and one line says where you are. */
function FinishMoment({ before, after, line, onClose }: { before: number; after: number; line: string; onClose: () => void }) {
  const { preferences, history } = useStillflow()
  const [minutes, setMinutes] = useState(before)
  useEffect(() => { const t = setTimeout(() => setMinutes(after), 250); return () => clearTimeout(t) }, [after])
  const week = thisWeek(history, localDate()).length
  return (
    <div className={styles.finish} role="status">
      <WeekRing minutes={minutes} sessions={week} target={preferences.weeklyTargetMinutes} link={false} />
      <p className={styles.finishLine}>{line}</p>
      <p className={styles.namaste}>Namaste</p>
      <div className={styles.done}><Button onClick={onClose}>Done</Button></div>
    </div>
  )
}

/** Mark as done, and editing an existing history entry. */
export function CompleteSheet({
  open, session, entry, onClose,
}: { open: boolean; session: Session; entry?: PracticeEntry; onClose: () => void }) {
  const state = useStillflow()
  const { savePractice, deletePractice, toast, history, userData, upsertSessions } = state
  const [date, setDate] = useState(entry?.date ?? localDate())
  const [minutes, setMinutes] = useState(String(entry?.minutes ?? session.durationMinutes))
  const known = userData[session.id]?.rating
  const [rating, setRating] = useState<number | undefined>(entry?.rating ?? known)
  const [note, setNote] = useState(entry?.note ?? '')
  const [feel, setFeel] = useState<number | undefined>(entry?.feel)
  const [goals, setGoals] = useState<string[]>(session.objectives.filter((o) => GOOD_FOR_GOALS.some((g) => g.value === o)))
  const [areas, setAreas] = useState<string[]>(session.physicalFocus.filter((a) => GOOD_FOR_AREAS.includes(a)))
  const [finished, setFinished] = useState<null | { before: number; after: number; line: string }>(null)
  // The second time is when you know whether you'd come back to it.
  const timesBefore = history.filter((h) => h.sessionId === session.id && h.id !== entry?.id).length
  const askRating = !entry && !known && timesBefore >= 1
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const save = () => {
    const today = localDate()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      toast('Choose a date that isn’t in the future.', 'danger')
      return
    }
    const base = entry ?? newEntry(session, { date })
    const saved: PracticeEntry = {
      ...base,
      date,
      minutes: Number(minutes) > 0 ? Math.round(Number(minutes)) : session.durationMinutes,
      rating,
      note: note.trim() || undefined,
      feel,
    }
    const before = summarise(thisWeek(history.filter((h) => h.id !== saved.id), today)).minutes
    savePractice(saved)
    const learned = learnFromPractice(session, feel, goals, areas)
    if (learned) void upsertSessions([learned])
    if (entry) {
      toast('Practice updated', 'success')
      onClose()
      return
    }
    const after = summarise(thisWeek([saved, ...history], today)).minutes
    const count = thisWeek([saved, ...history], today).length
    const line = seriesLine(session, saved, state)
      ?? (history.length === 0 ? 'Your first practice in Stillflow' : `Your ${nth(count)} practice this week`)
    setFinished({ before, after, line })
  }

  return (
    <Modal open={open} onClose={onClose} title={finished ? 'Well practised' : entry ? 'Edit practice' : 'Mark as done'}>
      {finished ? <FinishMoment {...finished} onClose={onClose} /> : (
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className={styles.lede}>{shortTitle(session, state.seriesDefs).title}</p>
        <div className={styles.row}>
          <Field label="Date" type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} required />
          <Field label="Minutes" type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <fieldset className={styles.group}>
          <legend>How did it feel?</legend>
          <div className={styles.feels}>
            {FEELS.map((f) => (
              <button key={f.value} type="button" aria-pressed={feel === f.value} onClick={() => setFeel(feel === f.value ? undefined : f.value)}>{f.label}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Good for <span className={styles.optional}>optional</span></legend>
          <div className={styles.chips}>
            {GOOD_FOR_GOALS.map((g) => <Chip key={g.value} selected={goals.includes(g.value)} onClick={() => setGoals(toggle(goals, g.value))}>{g.label}</Chip>)}
            {GOOD_FOR_AREAS.map((a) => <Chip key={a} tone="lavender" selected={areas.includes(a)} onClick={() => setAreas(toggle(areas, a))}>{a}</Chip>)}
          </div>
        </fieldset>
        <div className={askRating ? styles.ratingAsk : styles.rating}>
          <span>{askRating ? `Your ${nth(timesBefore + 1)} time with this one. Would you practise it again?` : 'Practise it again?'}</span>
          <RepeatRating value={rating} onChange={setRating} />
        </div>
        <TextAreaField label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="What you noticed, what felt good" />
        <ModalFooter onCancel={onClose} saveLabel={entry ? 'Save' : 'Record practice'}
          onDelete={entry ? () => { deletePractice(entry.id); onClose() } : undefined} />
      </form>
      )}
    </Modal>
  )
}

export function CollectionSheet({ open, session, onClose }: { open: boolean; session: Session; onClose: () => void }) {
  const { collections, saveCollection, toast } = useStillflow()
  const [name, setName] = useState('')

  const toggle = (id: string) => {
    const c = collections.find((x) => x.id === id)
    if (!c) return
    const has = c.sessionIds.includes(session.id)
    saveCollection({
      ...c,
      sessionIds: has ? c.sessionIds.filter((x) => x !== session.id) : [...c.sessionIds, session.id],
      updatedAt: new Date().toISOString(),
    })
    toast(has ? `Removed from ${c.name}` : `Added to ${c.name}`, 'success')
  }

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    saveCollection({ id: `c-${Date.now().toString(36)}`, name: trimmed, sessionIds: [session.id], createdAt: now, updatedAt: now })
    toast(`Added to ${trimmed}`, 'success')
    setName('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to collection">
      <div className={styles.form}>
        {collections.length > 0 && (
          <ul className={styles.list}>
            {collections.map((c) => {
              const has = c.sessionIds.includes(session.id)
              return (
                <li key={c.id}>
                  <button type="button" className={styles.option} aria-pressed={has} onClick={() => toggle(c.id)}>
                    <span className={styles.check}>{has && <Check size={16} />}</span>
                    <span>{c.name}</span>
                    <span className={styles.count}>{c.sessionIds.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form className={styles.create} onSubmit={(e) => { e.preventDefault(); create() }}>
          <Field label="New collection" placeholder="e.g. Morning mobility" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!name.trim()}><Plus size={16} /> Create</Button>
        </form>
        <div className={styles.done}><Button variant="secondary" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  )
}
