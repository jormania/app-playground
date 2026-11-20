import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { Button, Field, Modal, TextAreaField } from '../../ds'
import { ModalFooter } from '../../ds/components/ModalFooter'
import type { PracticeEntry, Session } from '../domain/types'
import { useStillflow } from '../app/state'
import { localDate, newEntry } from '../lib/practice'
import { RepeatRating } from './ui'
import styles from './Sheets.module.css'

/** Mark as Completed, and editing an existing history entry. */
export function CompleteSheet({
  open, session, entry, onClose,
}: { open: boolean; session: Session; entry?: PracticeEntry; onClose: () => void }) {
  const { savePractice, deletePractice, toast } = useStillflow()
  const [date, setDate] = useState(entry?.date ?? localDate())
  const [minutes, setMinutes] = useState(String(entry?.minutes ?? session.durationMinutes))
  const [rating, setRating] = useState<number | undefined>(entry?.rating)
  const [note, setNote] = useState(entry?.note ?? '')

  const save = () => {
    const today = localDate()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      toast('Choose a date that isn’t in the future.', 'danger')
      return
    }
    const base = entry ?? newEntry(session, { date })
    savePractice({
      ...base,
      date,
      minutes: Number(minutes) > 0 ? Math.round(Number(minutes)) : session.durationMinutes,
      rating,
      note: note.trim() || undefined,
    })
    toast(entry ? 'Practice updated' : 'Practice recorded', 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit practice' : 'Mark as completed'}>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className={styles.lede}>{session.title}</p>
        <div className={styles.row}>
          <Field label="Date" type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} required />
          <Field label="Minutes" type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className={styles.rating}>
          <span>Practise it again?</span>
          <RepeatRating value={rating} onChange={setRating} />
        </div>
        <TextAreaField label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="What you noticed, what felt good" />
        <ModalFooter onCancel={onClose} saveLabel={entry ? 'Save' : 'Record practice'}
          onDelete={entry ? () => { deletePractice(entry.id); onClose() } : undefined} />
      </form>
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
