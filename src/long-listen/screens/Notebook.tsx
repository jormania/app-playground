import { useEffect, useRef, useState } from 'react'
import type { Concert, Feedback, Programme, TasteObservation } from '../domain/types'
import { displaySurname } from '../domain/identity'
import { curly } from '../domain/programmeStyle'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useKept } from '../app/kept'
import { useFollow } from '../app/follow'
import { TASTE_TIDY_ABOVE, observationsByStance, pendingFeedback } from '../curation/taste'
import { CharCount, Empty, MAX_ASK, MAX_NOTE, NeedsKey, Problem, Waiting, messageOf } from '../components/common'
import { Twisty } from '../components/Twisty'
import s from '../styles/editorial.module.css'

const STANCE_TITLE: Record<TasteObservation['stance'], string> = {
  'drawn-to': 'Drawn to',
  'curious-about': 'Curious about',
  mixed: 'Mixed feelings',
  'wary-of': 'Wary of',
}

/** What each piece of feedback was said of, in the listener's terms: the work, the concert, the programme. */
function whatWasSaidOf(feedback: Feedback[], programmes: Programme[], concerts: Concert[]): Map<string, string> {
  const items = programmes.flatMap((p) => p.sections.flatMap((x) => x.items))
  const out = new Map<string, string>()
  for (const f of feedback) {
    const { type, id } = f.target
    const item = type === 'work' ? items.find((i) => i.workId === id) : type === 'recording' || type === 'interpretation' ? items.find((i) => i.recordingId === id) : undefined
    const words = item ? `${displaySurname(item.proposed.composer)}’s ${curly(item.proposed.work)}`
      : type === 'concert' ? (() => { const c = concerts.find((x) => x.id === id); return c ? `the concert at ${c.venue}` : undefined })()
      : type === 'programme' ? (() => { const p = programmes.find((x) => x.id === id); return p ? `“${p.title}”` : undefined })()
      : undefined
    if (words) out.set(f.id, words)
  }
  return out
}

/** "From what you said of Sibelius’s Tapiola and Debussy’s La mer" — two at most, then "and elsewhere". */
function evidenceWords(o: TasteObservation, said: Map<string, string>): string {
  const names = [...new Set(o.evidence.map((id) => said.get(id)).filter((x): x is string => Boolean(x)))]
  if (!names.length) return ''
  const shown = names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and elsewhere`
  return `From what you said of ${shown}.`
}

/**
 * What the curator has come to understand about the listener — in words, with
 * how sure it is, and how it has changed. Editable at the one point where the
 * listener can simply tell the curator something.
 */
export function NotebookScreen() {
  const { repo, journey, bump, say, curatorReady } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const [taste, prefs, feedback, programmes, concerts] = await Promise.all([repo.taste(), repo.preferences(), repo.feedback.all(), repo.programmes.all(), repo.concerts.all()])
    return { taste, prefs, pending: pendingFeedback(feedback).length, feedback, said: whatWasSaidOf(feedback, programmes, concerts) }
  }, [])
  // "Not quite": the observation it is about, and what is being typed for it.
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')
  const [sending, setSending] = useState(false)
  // Typed and not yet kept: a draft that outlives leaving the page, and wins over the saved text when it comes back.
  const [notes, setNotes, , showNotes] = useKept('notebook-notes', 'device')
  const [wish, setWish, , showWish] = useKept('notebook-wish', 'device')
  const [reading, setReading] = useState(false)
  const { following, follow } = useFollow()
  // Each field filled from what is kept once, on opening: the page reloads whenever anything is saved (the
  // other field, a taste reading, a Spotify sync), and a refill then threw away what was being typed.
  const filled = useRef(false)
  useEffect(() => {
    if (!data || filled.current) return
    filled.current = true
    if (!notes) showNotes(data.taste.notesToCurator)
    if (!wish) showWish(data.prefs.nextRequest)
    // Once, on opening: what is typed afterwards is the listener's, never overwritten by a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showNotes(notes.trim())
      bump()
      say('Kept. The curator reads it with everything it writes from now on.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  async function saveWish() {
    try {
      await repo.savePreferences({ ...(await repo.preferences()), nextRequest: wish.trim() })
      showWish(wish.trim())
      bump()
      say(wish.trim() ? 'The curator will read this when next week begins.' : 'Cleared.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  // Followed: not offered again, where a second tap would pay for the same three directions twice.
  const followQuestion = (q: string) => follow(q, async () => {
    const current = await repo.taste()
    await repo.saveTaste({ ...current, questions: current.questions.filter((x) => x !== q) })
  })

  /**
   * The listener says an observation isn't quite right: kept as feedback on it,
   * read into taste at once when the curator can be asked (the prompt replaces
   * it with what their words support), or with the next reading otherwise.
   */
  async function notQuite(o: TasteObservation) {
    setSending(true)
    try {
      await journey.giveFeedback({ target: { type: 'observation', id: o.id }, note: correction.trim() || 'Not quite right.' })
      setCorrecting(null)
      setCorrection('')
      bump()
      if (curatorReady) {
        say('Said. The curator is reconsidering it now.', 'success')
        void journey.interpretPendingFeedback().then(() => bump(), (e: unknown) => say(messageOf(e), 'danger'))
      } else {
        say('Said. The curator reconsiders it when it next reads what you’ve said.', 'success')
      }
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setSending(false)
    }
  }

  async function tidyNow() {
    setReading(true)
    try { await journey.interpretPendingFeedback({ tidy: true }); say('Gathered.', 'success'); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setReading(false) }
  }

  async function readNow() {
    setReading(true)
    try { if (await journey.interpretPendingFeedback()) say('Read.', 'success'); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setReading(false) }
  }

  const observation = (o: TasteObservation, folded = false) => (
    <li key={o.id}>
      {o.statement} {o.confidence !== 'settled' && !folded && <span className={s.faint}>({o.confidence === 'tentative' ? 'a first impression' : 'becoming clearer'})</span>}
      {/* What it rests on, in the listener's own terms: a reason they can check, not a label. */}
      {evidenceWords(o, data.said) && <span className={s.observationWhy}>{evidenceWords(o, data.said)}</span>}
      {data.feedback.some((f) => f.target.type === 'observation' && f.target.id === o.id && !f.interpretedAt)
        ? <span className={s.observationWhy}>You said this isn’t quite right; the curator will reconsider it.</span>
        : correcting === o.id ? (
          <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); if (!sending) void notQuite(o) }}>
            <label className={s.visuallyHidden} htmlFor={`nq-${o.id}`}>What would be closer?</label>
            <input id={`nq-${o.id}`} className={s.input} maxLength={MAX_ASK} placeholder="What would be closer? (optional)" value={correction} onChange={(e) => setCorrection(e.target.value)} disabled={sending} autoFocus />
            <div className={s.actions}>
              <button type="submit" className={`${s.outlineButton} ${s.smallButton}`} disabled={sending}>{sending ? 'Telling the curator…' : 'Tell the curator'}</button>
              <button type="button" className={s.textButton} onClick={() => { setCorrecting(null); setCorrection('') }}>Never mind</button>
            </div>
          </form>
        ) : (
          <>{' '}<button className={`${s.textButton} ${s.quietButton}`} onClick={() => { setCorrecting(o.id); setCorrection('') }}>Not quite</button></>
        )}
    </li>
  )

  const empty = Object.values(groups).every((g) => g.length === 0)
  const active = Object.values(groups).reduce((n, g) => n + g.length, 0)

  return (
    <div>
      <p className={s.eyebrow}>Notebook</p>
      {/* Not "Your listening": on a programme that names a work's heard state. */}
      <h1 className={s.title}>What the curator has noticed</h1>
      <p className={s.dek}>Not a score: sentences about your listening, the surer ones first.</p>

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
      {/* Grown long, it can be gathered into fewer lines; it also happens by itself with the next reading. */}
      {active > TASTE_TIDY_ABOVE && data.pending === 0 && curatorReady && (
        <p className={s.faint}>
          This has grown long.{' '}
          <button className={s.textButton} onClick={() => void tidyNow()} disabled={reading}>{reading ? 'Gathering…' : 'Gather it into fewer lines'}</button>
        </p>
      )}
      {empty && data.pending === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. A word after a recording — how it landed, what stayed with you — is how this begins.</Empty>}

      {(Object.keys(STANCE_TITLE) as TasteObservation['stance'][]).map((stance) => {
        // What the curator is fairly sure of first; single remarks fold beneath it, so the page stays a portrait.
        const firm = groups[stance].filter((o) => o.confidence !== 'tentative')
        const first = groups[stance].filter((o) => o.confidence === 'tentative')
        if (!firm.length && !first.length) return null
        return (
          <section key={stance} className={s.block}>
            <h2 className={s.sectionHead}>{STANCE_TITLE[stance]}</h2>
            {firm.length > 0
              ? (
                <>
                  <ul className={s.bullets}>{firm.map((o) => observation(o))}</ul>
                  {first.length > 0 && (
                    <Twisty label="First impressions" value="from a single remark, not yet sure" open={first.some((o) => o.id === correcting)}>
                      <ul className={s.bullets}>{first.map((o) => observation(o, true))}</ul>
                    </Twisty>
                  )}
                </>
              )
              : <ul className={s.bullets}>{first.map((o) => observation(o))}</ul>}
          </section>
        )
      })}

      {taste.questions.length > 0 && (
        <section className={s.block}>
          <h2 className={s.sectionHead}>Questions you seem to be asking</h2>
          <p className={s.sectionGuide}>Each can become a week. <em>Ask for three directions from it</em>: before you’ve chosen this week, they replace the three on offer (those stay open); after, they wait under Where next.</p>
          {!curatorReady && <NeedsKey to="ask for directions from one" />}
          <ul className={s.bullets}>
            {taste.questions.map((q, i) => (
              <li key={i}>
                {q}{' '}
                <span className={s.followLinks}>
                  <button className={s.textButton} onClick={() => void followQuestion(q)} disabled={following !== null || !curatorReady}>{following === q ? 'The curator is finding three…' : 'Ask for three directions from it'}</button>
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
        <p className={s.sectionGuide}>Read once, when next week’s three directions are written, then cleared. Once most of this week is heard, <em>Shape next week</em> under the programme’s Where next takes it further: where next week goes, and sketches of its three.</p>
        <label className={s.visuallyHidden} htmlFor="wish">A wish for next week</label>
        <textarea id="wish" className={s.textarea} maxLength={MAX_ASK} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="More Sibelius · something I can listen to while cooking · the orchestra in Latin America" />
        <CharCount value={wish} />
        <div className={s.actions}>
          <button className={s.primaryButton} onClick={saveWish} disabled={wish.trim() === data.prefs.nextRequest}>Keep this wish</button>
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.sectionHead}>A note to the curator</h2>
        <p className={s.sectionGuide}>Anything you’d like it to keep in mind: a composer you’re curious about, music you already know well (so it isn’t offered as new), a mood you’re in. If a line above isn’t right, <em>Not quite</em> beside it says so to that line alone. How much music, how widely it ranges, recordings and language are set in <a href={href({ name: 'settings' })}>Settings</a>.</p>
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
