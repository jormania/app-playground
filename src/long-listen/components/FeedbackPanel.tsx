import { useState } from 'react'
import type { Feedback, FeedbackTargetType, Reaction, WantMore } from '../domain/types'
import { REACTIONS, WANT_MORE, latestFeedback, reactionLabel } from '../domain/listening'
import { useServices } from '../app/services'
import { messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * "How did this land?" — a few words and an optional sentence. Nothing here
 * is a rating: there are no numbers, no stars, and nothing is totalled. What
 * the listener writes is read by the curator into their taste.
 */
export function FeedbackPanel({
  targets, programmeId, feedback, prompt = 'How did this land?', startOpen = false,
}: {
  /** The first is the default; a second lets the listener say it's about the work, not the recording. */
  targets: { type: FeedbackTargetType; id: string; label: string }[]
  programmeId?: string
  feedback: Feedback[]
  prompt?: string
  startOpen?: boolean
}) {
  const { journey, bump, say } = useServices()
  const [open, setOpen] = useState(startOpen)
  const [target, setTarget] = useState(0)
  const [reaction, setReaction] = useState<Reaction | undefined>()
  const [more, setMore] = useState<WantMore | undefined>()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const said = targets.map((t) => ({ t, f: latestFeedback(feedback, t.id) })).filter(({ f }) => f.reaction || f.notes.length)

  async function save() {
    if (!reaction && !more && !note.trim()) return
    setSaving(true)
    try {
      await journey.giveFeedback({ target: { type: targets[target].type, id: targets[target].id }, programmeId, reaction, more, note })
      setReaction(undefined)
      setMore(undefined)
      setNote('')
      setOpen(false)
      bump()
      // Read it into taste in the background; if the curator is away it waits for next time.
      journey.interpretPendingFeedback().then(() => bump()).catch(() => {})
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {said.map(({ t, f }) => (
        <p key={t.id} className={s.said}>
          {targets.length > 1 && <span className={s.label}>{t.label} · </span>}
          {reactionLabel(f.reaction)}
          {f.notes.length > 0 && <>{f.reaction ? ' — ' : ''}<q>{f.notes[f.notes.length - 1]}</q></>}
        </p>
      ))}
      {!open ? (
        <button className={s.textButton} onClick={() => setOpen(true)}>{said.length ? 'Add a thought' : prompt}</button>
      ) : (
        <div className={s.feedback}>
          {targets.length > 1 && (
            <div className={s.chips} role="radiogroup" aria-label="This is about">
              {targets.map((t, i) => (
                <button key={t.id} role="radio" aria-checked={target === i} className={`${s.chip} ${target === i ? s.chipOn : ''}`} onClick={() => setTarget(i)}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <p className={s.feedbackQ}>{prompt}</p>
          <div className={s.chips} role="radiogroup" aria-label={prompt}>
            {REACTIONS.map((r) => (
              <button key={r.value} role="radio" aria-checked={reaction === r.value} className={`${s.chip} ${reaction === r.value ? s.chipOn : ''}`} onClick={() => setReaction(reaction === r.value ? undefined : r.value)}>
                {r.label}
              </button>
            ))}
          </div>
          <label className={s.feedbackQ} htmlFor={`note-${targets[0].id}`}>What stayed with you?</label>
          <textarea id={`note-${targets[0].id}`} className={s.textarea} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — a sentence is plenty." />
          <p className={s.feedbackQ} style={{ marginTop: 'var(--space-md)' }}>Want more of this?</p>
          <div className={s.chips} role="radiogroup" aria-label="Want more of this?">
            {WANT_MORE.map((m) => (
              <button key={m.value} role="radio" aria-checked={more === m.value} className={`${s.chip} ${more === m.value ? s.chipOn : ''}`} onClick={() => setMore(more === m.value ? undefined : m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className={s.actions}>
            <button className={s.textButton} onClick={save} disabled={saving || (!reaction && !more && !note.trim())}>{saving ? 'Keeping it…' : 'Keep this'}</button>
            <button className={s.textButton} onClick={() => setOpen(false)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  )
}
