import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useTitle } from '../app/title'
import { Empty, Problem, Waiting } from '../components/common'
import { BackLink } from '../components/BackLink'
import { LibraryWorks, loadLibrary } from '../components/LibraryEntries'
import { ComposerLink } from './Composer'
import { performerEntries } from '../domain/library'
import s from '../styles/editorial.module.css'

/**
 * A performer's page — a conductor, a soloist, an orchestra: what you have met
 * of theirs, read from the Library the same way and shown the same way (the
 * works, the recordings they play on, what you said, the evenings you heard
 * them live). No portrait written for them: their part is in the recordings,
 * and a performer's life is the fact the curator is likeliest to get wrong.
 * Nothing counted.
 */
export function PerformerScreen({ performer }: { performer: string }) {
  const { repo, settings } = useServices()
  const { data, error, retry } = useLoad(async () => performerEntries(await loadLibrary(repo, settings), performer), [performer, settings.hideSkipped, settings.timeZone])
  useTitle(performer)
  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the performer…</Waiting>
  return (
    <article>
      <BackLink back to={href({ name: 'library' })} label="Library" />
      <h1 className={s.title}>{performer}</h1>
      {data.roles.length > 0 && <p className={s.listenFacts}>{data.roles.join(' · ')}</p>}
      {data.entries.length === 0
        ? <Empty link={{ href: href({ name: 'library' }), label: 'Library' }}>Nothing of theirs met yet.</Empty>
        : (
          <section className={s.block} aria-label="What you have met">
            <h2 className={s.sectionHead}>What you’ve heard them in</h2>
            {data.entries.map((e) => (
              <section key={e.composer} className={s.mtLg}>
                <h3 className={s.h3}><ComposerLink name={e.composer} /></h3>
                <LibraryWorks works={e.works} />
              </section>
            ))}
          </section>
        )}
    </article>
  )
}
