import { useState } from 'react'
import { curly } from '../domain/programmeStyle'
import { seasonName } from '../domain/season'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, NeedsKey, Paragraphs, Problem, Waiting, dateWords, messageOf } from '../components/common'
import { displaySurname, sameWork } from '../domain/identity'
import s from '../styles/editorial.module.css'
import { BackLink } from '../components/BackLink'

/**
 * A season in review: twelve weeks, read back as one page of prose — the
 * threads followed, where taste moved, what is still open, and a few works
 * worth hearing again. Written once a season is over, never before: a review
 * of half a season would be a guess at the rest.
 */
export function SeasonScreen({ n }: { n: number }) {
  const { journey, repo, curatorReady, bump, say } = useServices()
  const { data, error, retry } = useLoad(async () => ({ ...(await journey.seasonReview(n)), programmes: await repo.programmes.all() }), [n])
  const [writing, setWriting] = useState(false)

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'No season to read yet: the first begins with your first week.', link: { href: href({ name: 'journal' }), label: 'Journal' } }} />
  if (!data) return <Waiting>Opening the season…</Waiting>
  const { season, listened, review, programmes } = data
  // A work worth hearing again leads to its listening view — the latest programme it was in, with its notes and your earlier hearing.
  const againAt = (a: { composer: string; work: string }) => {
    for (const p of [...programmes].sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
      const item = p.sections.flatMap((x) => x.items).find((i) => sameWork({ composer: i.proposed.composer, title: i.proposed.work }, { composer: a.composer, title: a.work }))
      if (item) return href({ name: 'listen', programmeId: p.id, itemId: item.id })
    }
    return undefined
  }

  async function write() {
    setWriting(true)
    try { await journey.writeSeasonReview(n); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setWriting(false) }
  }

  return (
    <article>
      <BackLink back to={href({ name: 'journal' })} label="Journal" />
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
                  <li key={i} className={s.againItem}><strong><a href={href({ name: 'composer', composer: a.composer })} className={s.composerLink}>{displaySurname(a.composer)}</a>, {againAt(a) ? <a href={againAt(a)} className={s.quietLink}>{curly(a.work)}</a> : curly(a.work)}</strong> — {a.why}</li>
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
