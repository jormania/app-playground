import { useEffect, useState } from 'react'
import type { TasteObservation } from '../domain/types'
import { useLoad, useServices } from '../app/services'
import { observationsByStance, pendingFeedback } from '../curation/taste'
import { preferenceLines } from '../notion/mirror'
import { Empty, Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

const STANCE_TITLE: Record<TasteObservation['stance'], string> = {
  'drawn-to': 'Drawn to',
  'curious-about': 'Curious about',
  mixed: 'Mixed feelings',
  'wary-of': 'Wary of',
}

/**
 * What the curator has come to understand about the listener — in words, with
 * how sure it is, and how it has changed. Editable at the one point where the
 * listener can simply tell the curator something.
 */
export function NotebookScreen() {
  const { repo, journey, bump, say, notion, notionState, syncNotion } = useServices()
  const { data, error } = useLoad(async () => ({ taste: await repo.taste(), prefs: await repo.preferences(), pending: pendingFeedback(await repo.feedback.all()).length }), [])
  const [notes, setNotes] = useState('')
  const [wish, setWish] = useState('')
  const [reading, setReading] = useState(false)
  useEffect(() => { if (data) { setNotes(data.taste.notesToCurator); setWish(data.prefs.nextRequest) } }, [data])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the notebook…</Waiting>
  const { taste } = data
  const groups = observationsByStance(taste)
  const moved = taste.observations.filter((o) => o.supersededBy)
  const byId = new Map(taste.observations.map((o) => [o.id, o]))

  async function saveNotes() {
    const current = await repo.taste()
    await repo.saveTaste({ ...current, notesToCurator: notes.trim() })
    bump()
    say('The curator will read this from next week.', 'success')
  }

  async function saveWish() {
    await repo.savePreferences({ ...(await repo.preferences()), nextRequest: wish.trim() })
    bump()
    say(wish.trim() ? 'The curator will read this when next week begins.' : 'Cleared.', 'success')
  }

  async function readNow() {
    setReading(true)
    try { await journey.interpretPendingFeedback(); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setReading(false) }
  }

  const empty = Object.values(groups).every((g) => g.length === 0)

  return (
    <div>
      <p className={s.eyebrow}>Notebook</p>
      <h1 className={s.title}>Your listening, in words</h1>
      <p className={s.dek}>What the curator has noticed. Not a score — a few honest sentences, and how sure it is of each.</p>

      {empty && <Empty>Nothing yet. A word or two of feedback after a recording is how this begins.</Empty>}
      {data.pending > 0 && (
        <p className={s.faint}>
          Some of what you’ve said hasn’t been read yet.{' '}
          <button className={s.textButton} onClick={readNow} disabled={reading}>{reading ? 'Reading…' : 'Read it now'}</button>
        </p>
      )}

      {(Object.keys(STANCE_TITLE) as TasteObservation['stance'][]).map((stance) => groups[stance].length > 0 && (
        <section key={stance} className={s.block}>
          <h2 className={s.h2}>{STANCE_TITLE[stance]}</h2>
          <ul className={s.bullets}>
            {groups[stance].map((o) => (
              <li key={o.id}>{o.statement} {o.confidence !== 'settled' && <span className={s.faint}>({o.confidence === 'tentative' ? 'a first impression' : 'becoming clearer'})</span>}</li>
            ))}
          </ul>
        </section>
      ))}

      {taste.questions.length > 0 && (
        <section className={s.block}>
          <h2 className={s.h2}>Questions you seem to be asking</h2>
          <ul className={s.bullets}>{taste.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </section>
      )}

      {moved.length > 0 && (
        <section className={s.block}>
          <h2 className={s.h2}>How it has moved</h2>
          <ul className={s.bullets}>
            {moved.map((o) => {
              const now = o.supersededBy ? byId.get(o.supersededBy) : undefined
              return <li key={o.id}><span className={s.quiet}>Once: {o.statement}</span>{now && <> Now: {now.statement}</>}</li>
            })}
          </ul>
        </section>
      )}

      <section className={s.block}>
        <h2 className={s.h2}>What you’ve told the curator</h2>
        {/* A ledger, not a list: what each setting is, then what it says. */}
        <dl className={s.ledger}>
          {preferenceLines(data.prefs).map((l) => {
            const at = l.indexOf(': ')
            return at > 0
              ? <div key={l}><dt>{l.slice(0, at)}</dt><dd>{l.slice(at + 2)}</dd></div>
              : <div key={l}><dd className={s.ledgerWide}>{l}</dd></div>
          })}
        </dl>
        <p className={s.faint}><a href="#/settings">Change these in Settings</a></p>
      </section>

      <hr className={s.rule} />
      <section>
        <h2 className={s.h2}>A wish for next week</h2>
        <p className={s.quiet}>Read once, when the next week’s three directions are chosen — then cleared.</p>
        <label className={s.visuallyHidden} htmlFor="wish">A wish for next week</label>
        <textarea id="wish" className={s.textarea} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="More Sibelius · something I can listen to while cooking · the orchestra in Latin America" />
        <div className={s.actions}>
          <button className={s.outlineButton} onClick={saveWish} disabled={wish.trim() === data.prefs.nextRequest}>Keep this wish</button>
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>A note to the curator</h2>
        <p className={s.quiet}>Anything you’d like it to keep in mind — a composer you’re curious about, music you already know well (so it isn’t offered as new), how much time you have, a mood you’re in.</p>
        <label className={s.visuallyHidden} htmlFor="notes">Note to the curator</label>
        <textarea id="notes" className={s.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className={s.actions}>
          <button className={s.outlineButton} onClick={saveNotes} disabled={notes.trim() === taste.notesToCurator}>Keep this note</button>
        </div>
      </section>

      {notion && (
        <section className={s.block}>
          <h2 className={s.h2}>In Notion</h2>
          <p className={s.quiet}>
            Your journal, threads, recordings and this notebook are copied to Notion as readable pages.
            {notionState.lastSync && ` Last updated ${new Date(notionState.lastSync).toLocaleString()}.`}
          </p>
          {notionState.error && <p className={s.note}>{notionState.error}</p>}
          <button className={s.textButton} onClick={() => void syncNotion()} disabled={notionState.syncing}>{notionState.syncing ? 'Updating Notion…' : 'Update Notion now'}</button>
        </section>
      )}
    </div>
  )
}
