import { useEffect, useRef, useState } from 'react'
import { composerEntry } from '../domain/composerGroups'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, NeedsKey, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import { LibraryWorks, loadLibrary } from '../components/LibraryEntries'
import type { PortraitResponse } from '../curation/api'
import s from '../styles/editorial.module.css'
import { useTitle } from '../app/title'
import { BackLink } from '../components/BackLink'

/**
 * A composer's page: who they were, in a short portrait written once (Haiku,
 * kept), then what of theirs you have met — their entry in the Library, read
 * the same way and shown the same way: the works, the recordings that played
 * and what you said, the concerts you heard them at. Prose and memory, not a
 * tally: nothing here is counted.
 */
export function ComposerScreen({ composer }: { composer: string }) {
  const { repo, journey, curatorReady, bump, say, settings } = useServices()
  const { data, error, retry } = useLoad(async () => {
    // One composer however the name was written, as the Library groups them.
    const entry = composerEntry(await loadLibrary(repo, settings), composer)
    const name = entry?.composer ?? composer
    return { name, works: entry?.works ?? [], portrait: await firstPortrait(journey, [name, ...(entry?.spellings ?? [])]) }
  }, [composer, settings.hideSkipped, settings.timeZone])
  useTitle(data?.name ?? composer)

  // The portrait is written the first time the page is opened, then kept.
  const [writing, setWriting] = useState(false)
  const [failed, setFailed] = useState(false)
  const asked = useRef(false)
  useEffect(() => {
    if (!data || data.portrait || !curatorReady || asked.current || !data.works.length) return
    asked.current = true
    setWriting(true)
    // A failed writing is offered again, by hand — never retried by itself on each refresh.
    journey.portrait(data.name, data.works.map((w) => w.work.title)).then(bump, (e: unknown) => { setFailed(true); say(messageOf(e), 'danger') }).finally(() => setWriting(false))
  }, [data, curatorReady, journey, bump, say])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the composer…</Waiting>
  const { name, portrait } = data

  return (
    <article>
      <BackLink back to={href({ name: 'library' })} label="Library" />
      <h1 className={s.title}>{name}</h1>
      {portrait?.lifespan && <p className={s.listenFacts}>{portrait.lifespan}</p>}
      {/* No drop cap: that is the programme's introduction's alone (§19). */}
      {portrait
        ? <Paragraphs text={portrait.portrait} className={s.prose} glossed />
        : writing ? <Waiting inline>The curator is writing a short portrait…</Waiting>
          : failed ? <button className={s.textButton} onClick={() => { setFailed(false); asked.current = false; bump() }}>Write the portrait</button>
          : !curatorReady && data.works.length > 0 ? <NeedsKey to="have the curator write a portrait" /> : null}

      {data.works.length === 0 && <Empty>Nothing of theirs met yet.</Empty>}
      {data.works.length > 0 && (
        <section className={s.block} aria-label="What you have met">
          <h2 className={s.sectionHead}>What you’ve met</h2>
          <LibraryWorks works={data.works} />
        </section>
      )}
    </article>
  )
}

/** A portrait kept under any spelling of the name: "Debussy" from a concert, then "Claude Debussy" from a programme, is one composer. */
async function firstPortrait(journey: { portraitOf(n: string): Promise<PortraitResponse | undefined> }, names: string[]): Promise<PortraitResponse | undefined> {
  for (const n of new Set(names)) {
    const p = await journey.portraitOf(n)
    if (p) return p
  }
  return undefined
}

/** A composer's name as a quiet link to their page. */
export function ComposerLink({ name }: { name: string }) {
  return <a href={href({ name: 'composer', composer: name })} className={s.composerLink}>{name}</a>
}
