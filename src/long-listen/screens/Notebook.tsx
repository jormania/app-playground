import { useEffect, useRef, useState } from 'react'
import type { TasteObservation } from '../domain/types'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { observationsByStance, pendingFeedback } from '../curation/taste'
import { CharCount, Empty, MAX_ASK, MAX_NOTE, NeedsKey, Problem, Waiting, messageOf } from '../components/common'
import { Twisty } from '../components/Twisty'
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
  const { repo, journey, bump, say, week, curatorReady } = useServices()
  const { data, error, retry } = useLoad(async () => ({ taste: await repo.taste(), prefs: await repo.preferences(), pending: pendingFeedback(await repo.feedback.all()).length }), [])
  const [notes, setNotes] = useState('')
  const [wish, setWish] = useState('')
  const [reading, setReading] = useState(false)
  const [following, setFollowing] = useState<string | null>(null)
  // Each field filled from what is kept once, on opening: the page reloads whenever anything is saved (the
  // other field, a taste reading, a Spotify sync), and a refill then threw away what was being typed.
  const filled = useRef(false)
  useEffect(() => {
    if (!data || filled.current) return
    filled.current = true
    setNotes(data.taste.notesToCurator)
    setWish(data.prefs.nextRequest)
  }, [data])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the notebook…</Waiting>
  const { taste } = data
  const groups = observationsByStance(taste)
  const moved = taste.observations.filter((o) => o.supersededBy)
  const byId = new Map(taste.observations.map((o) => [o.id, o]))
  // What an impression became in the end: followed through every later one, not just the next (which may itself be past).
  const nowOf = (o: TasteObservation) => {
    let cur = o
    const seen = new Set<string>()
    while (cur.supersededBy && !seen.has(cur.id)) { seen.add(cur.id); const next = byId.get(cur.supersededBy); if (!next) break; cur = next }
    return cur === o ? undefined : cur
  }

  async function saveNotes() {
    try {
      const current = await repo.taste()
      await repo.saveTaste({ ...current, notesToCurator: notes.trim() })
      bump()
      say('Kept. The curator reads it with everything it writes from now on.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  async function saveWish() {
    try {
      await repo.savePreferences({ ...(await repo.preferences()), nextRequest: wish.trim() })
      bump()
      say(wish.trim() ? 'The curator will read this when next week begins.' : 'Cleared.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  /**
   * A question the curator heard, turned into directions in one tap: before a
   * choice this week they replace the three on offer (which stay open), after
   * one they wait under "Where next". Followed, it leaves the list.
   */
  async function follow(q: string) {
    setFollowing(q)
    try {
      const thisWeek = await repo.weeks.get(week.key)
      let said: string | undefined
      if (thisWeek?.programmeId) {
        await journey.moreDirections(q)
        said = 'Three directions from your question are waiting under “Where next”, at the end of this week’s programme.'
      } else if (thisWeek) {
        await journey.offerOtherDirections(q)
        said = 'Three directions from your question are on This week. The three before stay open.'
      } else {
        // No week yet: its first three directions start from the question — one call, and next week's wish is left alone.
        await journey.ensureWeek(q)
      }
      // Followed: not offered again, where a second tap would pay for the same three directions twice.
      const current = await repo.taste()
      await repo.saveTaste({ ...current, questions: current.questions.filter((x) => x !== q) })
      bump()
      if (said) say(said, 'success')
      go({ name: 'week' })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setFollowing(null)
    }
  }

  async function readNow() {
    setReading(true)
    try { if (await journey.interpretPendingFeedback()) say('Read.', 'success'); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setReading(false) }
  }

  const empty = Object.values(groups).every((g) => g.length === 0)

  return (
    <div>
      <p className={s.eyebrow}>Notebook</p>
      <h1 className={s.title}>Your listening, in words</h1>
      <p className={s.dek}>What the curator has noticed. Not a score — a few honest sentences, and how sure it is of each.</p>

      {/* What waits to be read comes first: it is what would fill the page. */}
      {data.pending > 0 && (
        <>
          <p className={s.faint}>
            Some of what you’ve said hasn’t been read yet.{' '}
            {curatorReady && <button className={s.textButton} onClick={() => void readNow()} disabled={reading}>{reading ? 'Reading…' : 'Read it now'}</button>}
          </p>
          {!curatorReady && <NeedsKey to="have it read" />}
        </>
      )}
      {empty && data.pending === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. A word after a recording — how it landed, what stayed with you — is how this begins.</Empty>}

      {(Object.keys(STANCE_TITLE) as TasteObservation['stance'][]).map((stance) => groups[stance].length > 0 && (
        <section key={stance} className={s.block}>
          <h2 className={s.sectionHead}>{STANCE_TITLE[stance]}</h2>
          <ul className={s.bullets}>
            {groups[stance].map((o) => (
              <li key={o.id}>{o.statement} {o.confidence !== 'settled' && <span className={s.faint}>({o.confidence === 'tentative' ? 'a first impression' : 'becoming clearer'})</span>}</li>
            ))}
          </ul>
        </section>
      ))}

      {taste.questions.length > 0 && (
        <section className={s.block}>
          <h2 className={s.sectionHead}>Questions you seem to be asking</h2>
          <p className={s.sectionGuide}>Each can become a week. <em>Follow this</em> asks the curator for three directions from it: before you’ve chosen this week, they replace the three on offer (those stay open); after, they wait under Where next.</p>
          {!curatorReady && <NeedsKey to="follow one now" />}
          <ul className={s.bullets}>
            {taste.questions.map((q, i) => (
              <li key={i}>
                {q}{' '}
                <span className={s.followLinks}>
                  <button className={s.textButton} onClick={() => void follow(q)} disabled={following !== null || !curatorReady}>{following === q ? 'The curator is finding three…' : 'Follow this'}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* History, kept but folded. */}
      {moved.length > 0 && (
        <Twisty className={s.mtXl} label="How it has moved" value="earlier impressions, kept">
          <ul className={s.bullets}>
            {moved.map((o) => {
              const now = nowOf(o)
              return <li key={o.id}><span className={s.quiet}>Once: {o.statement}</span>{now && <> Now: {now.statement}</>}</li>
            })}
          </ul>
        </Twisty>
      )}

      <section className={s.block}>
        <h2 className={s.sectionHead}>A wish for next week</h2>
        <p className={s.sectionGuide}>Read once, when next week’s three directions are written, then cleared.</p>
        <label className={s.visuallyHidden} htmlFor="wish">A wish for next week</label>
        <textarea id="wish" className={s.textarea} maxLength={MAX_ASK} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="More Sibelius · something I can listen to while cooking · the orchestra in Latin America" />
        <CharCount value={wish} />
        <div className={s.actions}>
          <button className={s.primaryButton} onClick={saveWish} disabled={wish.trim() === data.prefs.nextRequest}>Keep this wish</button>
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.sectionHead}>A note to the curator</h2>
        <p className={s.sectionGuide}>Anything you’d like it to keep in mind: a composer you’re curious about, music you already know well (so it isn’t offered as new), a mood you’re in. If something above is wrong, say so here. How much music, how widely it ranges, recordings and language are set in <a href={href({ name: 'settings' })}>Settings</a>.</p>
        <label className={s.visuallyHidden} htmlFor="notes">Note to the curator</label>
        <textarea id="notes" className={s.textarea} maxLength={MAX_NOTE} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <CharCount value={notes} max={MAX_NOTE} />
        <div className={s.actions}>
          <button className={s.primaryButton} onClick={saveNotes} disabled={notes.trim() === taste.notesToCurator}>Keep this note</button>
        </div>
      </section>

    </div>
  )
}
