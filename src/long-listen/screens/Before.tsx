import { useEffect, useRef, useState } from 'react'
import { Landmark } from 'lucide-react'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { creditLine } from '../domain/identity'
import { curly } from '../domain/programmeStyle'
import { isoDateIn } from '../domain/week'
import { daysUntil, goingStage, whenWords, type Going } from '../domain/going'
import { venueShort } from '../live/live'
import { searchUrl } from '../spotify/client'
import { spotifyQuery } from '../components/RecordingBlock'
import { Credits } from '../components/Credits'
import { Gloss } from '../components/Gloss'
import { NeedsKey, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import { NotFound } from '../store/repo'
import { concertDate } from '../components/ConcertEntry'
import { ComposerLink } from './Composer'
import s from '../styles/editorial.module.css'
import { useTitle } from '../app/title'
import { BackLink } from '../components/BackLink'

/**
 * Before a concert marked as going: the evening's works, read from the hall's
 * listing, each with a few lines, one recording to hear first, and what to
 * listen for in the hall that a recording can't give. Written once, on the
 * first visit in the week before it (Sonnet, a few cents), and kept.
 */
export function BeforeScreen({ goingKey }: { goingKey: string }) {
  const { repo, journey, curatorReady, bump, say, settings } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const going = (await repo.marks.get(`going:${goingKey}`))?.value as Going | undefined
    if (!going) throw new NotFound(`no concert marked ${goingKey}`)
    return { going, prep: await journey.preparation(goingKey) }
  }, [goingKey])
  useTitle(data ? `Before ${data.going.event.title}` : undefined)
  const [writing, setWriting] = useState(false)
  const asked = useRef(false)
  const today = isoDateIn(new Date(), settings.timeZone)
  const stage = data ? goingStage(data.going, today) : undefined
  // The page is the asking: opened in the week before the concert, it is written — once. Not
  // further off (a paid reading of a listing that may yet change), nor once it has passed.
  useEffect(() => {
    if (!data || data.prep || stage !== 'ahead' || !curatorReady || asked.current) return
    asked.current = true
    setWriting(true)
    journey.prepare(goingKey).then(bump, (e: unknown) => say(messageOf(e), 'danger')).finally(() => setWriting(false))
  }, [data, stage, curatorReady, journey, goingKey, bump, say])

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'That concert isn’t marked as one you’re going to any more.', link: { href: href({ name: 'week' }), label: 'This week' } }} />
  if (!data) return <Waiting>Opening the concert…</Waiting>
  const { going, prep } = data
  const e = going.event
  const d = daysUntil(e.date, today)
  const passed = d < 0

  // Not going after all, or (once it has passed) didn't go: the mark goes, and its card with it.
  async function notGoing() {
    try { await journey.goingTo(e, false); bump(); go({ name: 'week' }) } catch (x) { say(messageOf(x), 'danger') }
  }

  return (
    <article>
      <BackLink back to={href({ name: 'week' })} label="This week" />
      <p className={s.composer}><Landmark size={16} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> {passed ? 'After the concert' : 'Before the concert'} · {venueShort(e.venue)}{e.hall ? `, ${e.hall}` : ''}</p>
      <h1 className={s.titleSmall}>{e.title}</h1>
      {/* The date once: "today", "tonight" or "tomorrow" only add to it. */}
      <p className={s.dek}>{concertDate(e.date)}{e.time ? `, ${e.time}` : ''}{d >= 0 && d <= 1 ? ` — ${whenWords(e.date, today, e.time)}.` : ''}</p>

      {!prep && stage === 'later' && <p className={s.quiet}>Its preparation is written in the week before the concert.</p>}
      {!prep && stage === 'ahead' && (writing
        ? <Waiting>The curator is reading the programme and preparing the evening…</Waiting>
        : curatorReady
          ? <button className={s.outlineButton} onClick={() => { asked.current = false; retry() }}>Prepare it</button>
          : <NeedsKey to="have the curator prepare it" />)}

      {prep && (
        <>
          <Credits r={{ conductor: prep.conductor, orchestra: prep.orchestra, soloists: prep.soloists }} className={s.concertCredits} programme />
          <Paragraphs text={prep.intro} className={`${s.prose} ${s.lede}`} glossed />
          {prep.works.length > 0 && (
            <ol className={s.beforeWorks}>
              {prep.works.map((w, i) => {
                const rec = w.recording && { composer: w.composer, work: w.title, catalogue: w.catalogue, conductor: w.recording.conductor, orchestra: w.recording.orchestra, soloists: w.recording.soloists, year: w.recording.year }
                return (
                  <li key={`${i}-${w.title}`} className={s.beforeWork}>
                    <p className={s.composer}><ComposerLink name={w.composer} /></p>
                    <h2 className={s.work}>{curly(w.title)}{w.catalogue ? <span className={s.faint}>, {w.catalogue}</span> : null}</h2>
                    {w.about && <p className={s.prose}><Gloss text={w.about} /></p>}
                    {w.listenFor && <p><span className={s.label}>In the hall</span><br /><Gloss text={w.listenFor} /></p>}
                    {rec && (
                      <p className={s.quiet}>
                        <span className={s.label}>To hear first</span><br />
                        {creditLine(rec)}{rec.year ? `, ${rec.year}` : ''} · <a href={searchUrl(spotifyQuery(rec))} target="_blank" rel="noopener noreferrer">Look for it on Spotify ↗</a>
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {prep.inTheHall && <p className={`${s.whyBoth} ${s.mtLg}`}>{prep.inTheHall}</p>}
        </>
      )}

      {going.concertId
        // Kept already: the entry is where this evening lives now.
        ? <p className={s.mtLg}><a className={s.textButton} href={href({ name: 'concert', id: going.concertId })}>Your entry for this concert →</a></p>
        : (
          <div className={`${s.actions} ${s.mtLg}`}>
            {/* From the evening itself: back from the hall, the entry is what's wanted, not the preparation. */}
            {d <= 0 && <a className={s.primaryButton} href={href({ name: 'concert', id: `from-${goingKey}` })}>How was it? Add it to your concerts</a>}
            {e.link && /^https?:\/\//.test(e.link) && <a className={s.textButton} href={e.link} target="_blank" rel="noopener noreferrer">The hall’s page</a>}
            <button className={`${s.textButton} ${s.quietButton}`} onClick={() => void notGoing()}>{passed ? 'I didn’t go' : 'Not going after all'}</button>
          </div>
        )}
    </article>
  )
}
