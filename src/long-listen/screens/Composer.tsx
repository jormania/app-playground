import { useEffect, useRef, useState } from 'react'
import { Landmark } from 'lucide-react'
import type { Concert, ProposedRecording } from '../domain/types'
import { creditLine, fold } from '../domain/identity'
import { groupByComposer } from '../domain/composerGroups'
import { compactFacts } from '../domain/workFacts'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { curly } from '../domain/programmeStyle'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { NeedsKey, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import { concertDate } from './Concerts'
import { isoDateIn } from '../domain/week'
import type { PortraitResponse } from '../curation/api'
import s from '../styles/editorial.module.css'

const STATE_WORD: Record<string, string> = { listening: 'started', heard: 'heard', skipped: 'skipped' }

/**
 * A composer's page: who they were, in a short portrait written once (Haiku,
 * kept), then what of theirs you have met — the works, the recordings and
 * what you said, the concerts you heard them at, the threads they came up in.
 * Prose and memory, not a tally: nothing here is counted.
 */
export function ComposerScreen({ composer }: { composer: string }) {
  const { repo, journey, curatorReady, bump, say, settings } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const [programmes, works, events, feedback, concerts, themes] = await Promise.all([
      repo.programmes.all(), repo.works.all(), repo.events.all(), repo.feedback.all(), repo.concerts.all(), repo.themes.all(),
    ])
    const items = programmes.flatMap((p) => p.sections.flatMap((x) => x.items).map((item) => ({ p, item })))
    // One composer however the name was written, as the Library groups them.
    const names = [...items.map((x) => x.item.proposed.composer), ...concerts.flatMap((c) => c.works.map((w) => w.composer))]
    const groups = groupByComposer(names, (n) => n)
    const want = fold(composer)
    const [name, spellings] = [...groups].find(([n, list]) => fold(n) === want || list.some((x) => fold(x) === want)) ?? [composer, [composer]]
    const isTheirs = (n: string) => spellings.some((x) => fold(x) === fold(n))
    const workById = new Map(works.map((w) => [w.id, w]))
    const met = new Map<string, { title: string; recordings: { rid: string; proposed: ProposedRecording; programmeId: string; programmeTitle: string }[]; live: Concert[] }>()
    for (const { p, item } of [...items].sort((a, b) => a.p.createdAt.localeCompare(b.p.createdAt))) {
      if (!isTheirs(item.proposed.composer)) continue
      const m = met.get(item.workId) ?? { title: item.proposed.work, recordings: [], live: [] }
      if (!m.recordings.some((r) => r.rid === item.recordingId)) m.recordings.push({ rid: item.recordingId, proposed: item.proposed, programmeId: p.id, programmeTitle: p.title })
      met.set(item.workId, m)
    }
    // Heard live: concerts on or before today, never one still to come.
    const today = isoDateIn(new Date(), settings.timeZone)
    const live = concerts.filter((c) => c.date <= today && c.works.some((w) => isTheirs(w.composer))).sort((a, b) => b.date.localeCompare(a.date))
    for (const c of live) for (const w of c.works.filter((x) => isTheirs(x.composer))) {
      const m = met.get(w.workId) ?? { title: w.title, recordings: [], live: [] }
      m.live.push(c)
      met.set(w.workId, m)
    }
    // The threads they came up in: each theme once, with the programme it was met in.
    const themeById = new Map(themes.map((t) => [t.id, t]))
    const threads = new Map<string, { title: string; programmeId: string; programmeTitle: string }>()
    for (const { p, item } of items) if (isTheirs(item.proposed.composer) && themeById.get(p.themeId) && !threads.has(p.themeId)) threads.set(p.themeId, { title: themeById.get(p.themeId)!.title, programmeId: p.id, programmeTitle: p.title })
    return {
      name, works: [...met.entries()].map(([id, m]) => ({ id, work: workById.get(id), ...m })).sort((a, b) => a.title.localeCompare(b.title)),
      live, threads: [...threads.values()], events, feedback, portrait: await firstPortrait(journey, [name, ...spellings]),
    }
  }, [composer])

  // The portrait is written the first time the page is opened, then kept.
  const [writing, setWriting] = useState(false)
  const [failed, setFailed] = useState(false)
  const asked = useRef(false)
  useEffect(() => {
    if (!data || data.portrait || !curatorReady || asked.current || !data.works.length) return
    asked.current = true
    setWriting(true)
    // A failed writing is offered again, by hand — never retried by itself on each refresh.
    journey.portrait(data.name, data.works.map((w) => w.title)).then(bump, (e: unknown) => { setFailed(true); say(messageOf(e), 'danger') }).finally(() => setWriting(false))
  }, [data, curatorReady, journey, bump, say])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the composer…</Waiting>
  const { name, portrait } = data

  return (
    <article>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'library' })}>← Library</a></p>
      <h1 className={s.title}>{name}</h1>
      {portrait?.lifespan && <p className={s.listenFacts}>{portrait.lifespan}</p>}
      {portrait
        ? <Paragraphs text={portrait.portrait} className={`${s.prose} ${s.lede}`} glossed />
        : writing ? <p className={s.quiet}>The curator is writing a short portrait…</p>
          : failed ? <button className={s.textButton} onClick={() => { setFailed(false); asked.current = false; bump() }}>Write the portrait</button>
          : !curatorReady && data.works.length > 0 ? <NeedsKey to="have the curator write a portrait" /> : null}

      {data.works.length === 0 && <p className={s.quiet}>Nothing of theirs met yet.</p>}
      {data.works.length > 0 && (
        <section className={s.block} aria-label="What you have met">
          <h2 className={s.h2}>What you’ve met</h2>
          {data.works.map((w) => (
            <div key={w.id} className={s.libraryWork}>
              <p className={s.libraryTitle}>{curly(w.title)}</p>
              {w.work && compactFacts(w.work.form, w.work.catalogue, w.work.composed) && <p className={s.workMeta}>{compactFacts(w.work.form, w.work.catalogue, w.work.composed)}</p>}
              <ul className={s.libraryRecs}>
                {w.recordings.map((r) => {
                  const state = listeningState(data.events, r.rid)
                  const fb = latestFeedback(data.feedback, r.rid)
                  return (
                    <li key={r.rid} className={s.libraryRec}>
                      <span>{creditLine(r.proposed)}</span>
                      <span className={s.tagRow}>
                        {state !== 'not-started' && <span className={`${s.tag} ${state === 'heard' ? s.tagOn : ''}`}>{STATE_WORD[state]}</span>}
                        {fb.reaction && <span className={s.tag}>{reactionLabel(fb.reaction)?.toLowerCase()}</span>}
                        <span>from <a href={href({ name: 'programme', id: r.programmeId })} className={s.quietLink}>{r.programmeTitle}</a></span>
                      </span>
                      {fb.notes.length > 0 && <div className={s.said}><q>{fb.notes[fb.notes.length - 1]}</q></div>}
                    </li>
                  )
                })}
              </ul>
              {w.live.map((c) => (
                <p key={c.id} className={s.flush}>
                  <span className={`${s.tag} ${s.tagOn}`}><Landmark size={12} strokeWidth={1.8} aria-hidden="true" /> heard live</span>{' '}
                  <a href={href({ name: 'concert', id: c.id })} className={s.quietLink}>{c.venue}, {concertDate(c.date)}</a>
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      {data.threads.length > 0 && (
        <section className={s.block} aria-label="In your threads">
          <h2 className={s.h2}>In your threads</h2>
          <ul className={s.bullets}>
            {data.threads.map((t) => (
              <li key={t.programmeId}><a href={href({ name: 'threads' })} className={s.quietLink}>{t.title}</a>{t.programmeTitle !== t.title && <span className={s.faint}> · first met in <a href={href({ name: 'programme', id: t.programmeId })} className={s.quietLink}>{t.programmeTitle}</a></span>}</li>
            ))}
          </ul>
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
