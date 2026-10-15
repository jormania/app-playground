import { useState } from 'react'
import { curly } from '../domain/programmeStyle'
import { seasonName } from '../domain/season'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, NeedsKey, Paragraphs, Problem, Waiting, dateWords, messageOf } from '../components/common'
import { displaySurname } from '../domain/identity'
import s from '../styles/editorial.module.css'

/**
 * A season in review: twelve weeks, read back as one page of prose — the
 * threads followed, where taste moved, what is still open, and a few works
 * worth hearing again. Written once a season is over, never before: a review
 * of half a season would be a guess at the rest.
 */
export function SeasonScreen({ n }: { n: number }) {
  const { journey, curatorReady, bump, say } = useServices()
  const { data, error, retry } = useLoad(() => journey.seasonReview(n), [n])
  const [writing, setWriting] = useState(false)

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'No season to read yet: the first begins with your first week.', link: { href: href({ name: 'journal' }), label: 'Journal' } }} />
  if (!data) return <Waiting>Opening the season…</Waiting>
  const { season, listened, review } = data

  async function write() {
    setWriting(true)
    try { await journey.writeSeasonReview(n); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setWriting(false) }
  }

  return (
    <article>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'journal' })}>← Journal</a></p>
      <p className={s.composer}>{seasonName(season.number)} · {season.label}</p>

      {!season.begun ? (
        <Empty link={{ href: href({ name: 'journal' }), label: 'Journal' }}>This season hasn’t begun.</Empty>
      ) : review ? (
        <>
          <h1 className={s.title}>{review.title}</h1>
          <Paragraphs text={review.opening} className={`${s.lede} ${s.prose} ${s.mtMd}`} />

          {review.threads.length > 0 && (
            <>
              <h2 className={s.sectionHead}>The threads</h2>
              {review.threads.map((t, i) => (
                <div key={i} className={s.mtMd}>
                  <p className={s.libraryTitle}>{t.title}</p>
                  <Paragraphs text={t.body} className={s.prose} />
                </div>
              ))}
            </>
          )}

          {review.taste && (<><h2 className={s.sectionHead}>Where your taste moved</h2><Paragraphs text={review.taste} className={s.prose} /></>)}
          {review.open && (<><h2 className={s.sectionHead}>Still open</h2><Paragraphs text={review.open} className={s.prose} /></>)}

          {review.again.length > 0 && (
            <>
              <h2 className={s.sectionHead}>Worth hearing again</h2>
              <ul className={s.threadFacts}>
                {review.again.map((a, i) => (
                  <li key={i} className={s.againItem}><strong><a href={href({ name: 'composer', composer: a.composer })} className={s.composerLink}>{displaySurname(a.composer)}</a>, {curly(a.work)}</strong> — {a.why}</li>
                ))}
              </ul>
            </>
          )}

          {review.closing && <p className={`${s.dek} ${s.mtXl}`}>{review.closing}</p>}
        </>
      ) : (
        <>
          <h1 className={s.titleSmall}>The season in review</h1>
          <p className={s.dek}>Twelve weeks read back as one page: the threads you followed, where your taste moved, what is still open.</p>
          <div className={`${s.actions} ${s.mtLg}`}>
            {!season.complete
              ? <p className={s.note}>Under way — it ends on {dateWords(season.endsOn, 'UTC')}. Its review is written then.</p>
              : !listened
              ? <p className={s.note}>Nothing was listened to in these weeks, so there is nothing to read back.</p>
              : curatorReady
              ? <button className={s.outlineButton} onClick={() => void write()} disabled={writing}>{writing ? 'The curator is writing…' : 'Ask the curator to write it'}</button>
              : <NeedsKey to="have the curator write it" />}
          </div>
        </>
      )}
    </article>
  )
}
