import type { ListeningEvent, Programme, Work } from '../domain/types'
import { heldBy, seedFromThread, threadContents, threadsToShow, type ShownThread } from '../domain/threadContents'
import { standInsOf } from '../curation/continuity'
import { sinceWords, weekFromKey } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useFollow } from '../app/follow'
import { Empty, Problem, Waiting, madeWords } from '../components/common'
import { Twisty } from '../components/Twisty'
import { EveningMark } from '../components/Evening'
import { eveningSeed, isOwnEvening, threadMembers } from '../domain/evenings'
import s from '../styles/editorial.module.css'

/**
 * Themes as threads. Each one keeps every visit, how it landed, the questions
 * it left and where it could go next — the memory a returning theme is built
 * from. (Paths offered and not taken are on This week and in Where next.)
 * Its questions, its next directions and the thread itself each lead to a week
 * in one tap, as the Notebook's questions do.
 */
export function ThreadsScreen() {
  const { repo, week, settings, curatorReady } = useServices()
  const { following, follow } = useFollow()
  const { data, error, retry } = useLoad(async () => {
    const [themes, explorations, programmes, works, events, feedback, comparisons] = await Promise.all([
      repo.themes.all(), repo.explorations.all(), repo.programmes.all(), repo.works.all(), repo.events.all(), repo.feedback.all(), repo.comparisons.all(),
    ])
    // A work heard through a stand-in is heard.
    const standIns = standInsOf(comparisons)
    const byId = new Map(programmes.map((p) => [p.id, p]))
    // Evenings of their own belong to no thread: gathered at the foot, newest first, each one a seed (domain/evenings.ts).
    const members = threadMembers(explorations)
    const evenings = programmes.filter((p) => isOwnEvening(p, members)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      evenings,
      works: new Map(works.map((w) => [w.id, w])),
      events,
      standIns,
      threads: threadsToShow(themes, explorations, byId, events, feedback, standIns),
      programmes: byId,
    }
  }, [week.key])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Gathering the threads…</Waiting>

  return (
    <div>
      <p className={s.eyebrow}>Threads</p>
      <h1 className={s.title}>What we’ve been following</h1>
      <p className={s.dek}>A theme isn’t used up in a week. Each one here can return — from where it was left, not from the start.</p>

      {data.threads.length === 0
        ? <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. Choose a direction this week and the first thread begins.</Empty>
        : (
          <ul className={s.entries}>
            {data.threads.map((t) => <ThreadEntry key={t.theme.id} thread={t} programmes={data.programmes} works={data.works} events={data.events} standIns={data.standIns} now={week.key} hideSkipped={settings.hideSkipped} timeZone={settings.timeZone}
              follow={curatorReady ? follow : undefined} following={following} />)}
          </ul>
        )}

      {data.evenings.length > 0 && (
        <Twisty className={s.mtXl} label="Evenings of their own" value="newest first">
          <ul className={s.bullets}>
            {data.evenings.map((p) => {
              const seed = eveningSeed(p)
              return (
                <li key={p.id}>
                  <EveningMark /> <a href={href({ name: 'programme', id: p.id })}>{p.title}</a>
                  <span className={s.faint}> · {madeWords(p.createdAt, settings.timeZone)}, {weekFromKey(p.weekKey).label}</span>
                  {curatorReady && (
                    <>{' '}<button className={s.textButton} onClick={() => void follow(seed)} disabled={following !== null}>{following === seed ? 'The curator is finding three…' : 'Ask for three directions from this evening'}</button></>
                  )}
                </li>
              )
            })}
          </ul>
        </Twisty>
      )}
    </div>
  )
}


function ThreadEntry({ thread: { theme: t, visits, latest }, programmes, works, events, standIns, now, hideSkipped, timeZone, follow, following }: {
  thread: ShownThread; programmes: Map<string, Programme>
  works: Map<string, Work>; events: ListeningEvent[]; standIns: Map<string, string>; now: string; hideSkipped: boolean; timeZone: string
  /** Turn a seed into three directions (app/follow.ts); absent without a key. */
  follow?: (seed: string) => Promise<void>
  following: string | null
}) {
  // Each seed the thread left is one tap from a week: the Notebook's "Ask for three directions from it", here too.
  // Named with the thread, so a direction from it can return there rather than begin a second thread on the same ground.
  const followLink = (text: string) => {
    const seed = seedFromThread(text, t.title)
    return follow && (
      <>{' '}<button className={s.textButton} onClick={() => void follow(seed)} disabled={following !== null}>{following === seed ? 'The curator is finding three…' : 'Ask for three directions from it'}</button></>
    )
  }
  // The thread named, so the curator is given it even when it is older than the twelve it usually reads (curation/context.ts).
  const returnSeed = `Return to the thread “${t.title}”, continuing from where it was left — new works, new routes, never a restart.`
  const contents = threadContents(heldBy(visits, programmes), works, events, hideSkipped, standIns)
  // The line of visits is drawn when there is more than the title's one to show — and always when one was set aside, which only it says.
  const lineWorthDrawing = visits.length > 1 || visits.some((v) => v.setAside || v.extraProgrammeIds?.length || v.closingNote)
  return (
    <li className={s.entry}>
      <h2 className={s.entryTitle}>{latest ? <a className={s.titleLink} href={href({ name: 'programme', id: latest.programmeId })}>{t.title}</a> : t.title}</h2>
      {/* When, said once: each visit below carries its own dates. */}
      <p className={s.faint}>First explored {sinceWords(t.firstIntroduced, now)}</p>
      {t.summary && <p>{t.summary}</p>}
      {/* What the thread holds, one fact to a line on an accent edge — read at a glance, not as another paragraph. */}
      {contents && (
        <ul className={s.threadFacts} aria-label="What this thread holds">
          {contents.split(' · ').map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      )}
      {/* Its visits strung on one line, oldest first: the thread, drawn. */}
      {lineWorthDrawing && <ol className={s.threadLine} aria-label="Visits">
        {visits.map((v) => {
          const p = programmes.get(v.programmeId)
          // Every visit by its programme's name, then its week — the first included, even when the
          // thread took its name from it: a visit known only by its dates reads as missing its name.
          return (
            <li key={v.id} className={v.setAside ? s.setAsideVisit : undefined}>
              <a href={href({ name: 'programme', id: v.programmeId })}>{p?.title ?? weekFromKey(v.weekKey).label}</a>
              {p && <span className={s.faint}> · {weekFromKey(v.weekKey).label}</span>}
              {v.setAside && <span className={s.faint}> · set aside</span>}
              {/* Its companions, each on a line of its own, in the Journal's and the season's words. */}
              {(v.extraProgrammeIds ?? []).map((id) => programmes.get(id)).filter((x): x is Programme => Boolean(x)).map((x) => (
                <div key={x.id} className={s.faint}>{x.sitting ? `A sitting beside the theme, ${madeWords(x.createdAt, timeZone)}` : 'More of this theme'}: <a href={href({ name: 'programme', id: x.id })}>{x.title}</a></div>
              ))}
              {v.closingNote && <div className={`${s.quiet} ${s.italic}`}>{v.closingNote}</div>}
            </li>
          )
        })}
      </ol>}
      {t.reaction && (
        <div className={s.threadLanded}>
          <h3 className={s.h3}>How it landed</h3>
          <p className={s.italic}>{t.reaction}</p>
        </div>
      )}
      {(t.openQuestions.length > 0 || t.nextDirections.length > 0) && (
        <div className={s.threadNotes}>
          {t.openQuestions.length > 0 && (
            <div>
              <h3 className={s.h3}>Questions it left</h3>
              <ul className={s.bullets}>{t.openQuestions.map((q, i) => <li key={i}>{q}{followLink(q)}</li>)}</ul>
            </div>
          )}
          {t.nextDirections.length > 0 && (
            <div>
              <h3 className={s.h3}>Where it could go next</h3>
              <ul className={s.bullets}>{t.nextDirections.map((q, i) => <li key={i}>{q}{followLink(q)}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {follow && (
        <p className={s.mtSm}>
          <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void follow(returnSeed)} disabled={following !== null}>
            {following === returnSeed ? 'The curator is finding three…' : 'Return to this thread'}
          </button>
        </p>
      )}
    </li>
  )
}
