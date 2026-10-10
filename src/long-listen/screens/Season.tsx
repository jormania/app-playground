import { useState } from 'react'
import { seasonName } from '../domain/season'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * A season in review: twelve weeks, read back as one page of prose — the
 * threads followed, where taste moved, what is still open, and a few works
 * worth hearing again. Written once a season ends; before then, a provisional
 * "so far", rewritten at most once a week.
 */
export function SeasonScreen({ n }: { n: number }) {
  const { journey, curatorReady, bump, say } = useServices()
  const { data, error, retry } = useLoad(() => journey.seasonReview(n), [n])
  const [writing, setWriting] = useState(false)

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'No season to read yet: the first begins with your first week.', link: { href: href({ name: 'journal' }), label: 'Journal' } }} />
  if (!data) return <Waiting>Opening the season…</Waiting>
  const { season, review } = data
  // Too soon to read back: a season still to come, or one with a single week so far. Nothing to pay for.
  const tooSoon = !season.complete && season.weeksSoFar < 2

  async function write() {
    setWriting(true)
    try { await journey.writeSeasonReview(n); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setWriting(false) }
  }

  return (
    <article>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'journal' })}>← Journal</a></p>
      <p className={s.composer}>{seasonName(season.number)} · {season.label}</p>
      {!season.complete && season.weeksSoFar > 0 && <p className={`${s.faint} ${s.flush}`}>So far: {season.weeksSoFar} of 12 weeks. The full review is written when the season ends.</p>}

      {season.weeksSoFar === 0 ? (
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
                  <li key={i} className={s.againItem}><strong>{a.composer.split(' ').slice(-1)[0]}, {a.work}</strong> — {a.why}</li>
                ))}
              </ul>
            </>
          )}

          {review.closing && <p className={`${s.dek} ${s.mtXl}`}>{review.closing}</p>}
        </>
      ) : (
        <>
          <h1 className={s.titleSmall}>{season.complete ? 'The season in review' : 'The season so far'}</h1>
          <p className={s.dek}>Twelve weeks read back as one page: the threads you followed, where your taste moved, what is still open.</p>
          <div className={`${s.actions} ${s.mtLg}`}>
            {tooSoon
              ? <p className={s.note}>It can be read back once two weeks of it are behind you.</p>
              : curatorReady
              ? <button className={s.outlineButton} onClick={() => void write()} disabled={writing}>{writing ? 'The curator is writing…' : 'Ask the curator to write it'}</button>
              : <p className={s.note}>Add your Anthropic key in Settings to have the curator write it.</p>}
          </div>
        </>
      )}
    </article>
  )
}
