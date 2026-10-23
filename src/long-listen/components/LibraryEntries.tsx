import { Landmark } from 'lucide-react'
import type { Repo } from '../store/repo'
import { libraryEntries, catalogueNotInTitle, type LibraryComposer, type LibraryWorkEntry } from '../domain/library'
import { reactionLabel } from '../domain/listening'
import { compactFacts } from '../domain/workFacts'
import { curly } from '../domain/programmeStyle'
import { whoPlays } from '../domain/concertSoloists'
import { isoDateIn } from '../domain/week'
import { href } from '../app/router'
import { isConfirmed } from '../spotify/verify'
import { concertDate } from '../screens/Concerts'
import { Credits } from './Credits'
import s from '../styles/editorial.module.css'
import { StateTag } from './WorkRows'
import { OpenInSpotify } from './ListenBar'

/** Everything met so far, read the one way the Library and a composer's page both show it (domain/library.ts). */
export async function loadLibrary(repo: Repo, opts: { hideSkipped: boolean; timeZone: string }): Promise<LibraryComposer[]> {
  const [works, recordings, programmes, comparisons, events, feedback, concerts, weeks, explorations] = await Promise.all([
    repo.works.all(), repo.recordings.all(), repo.programmes.all(), repo.comparisons.all(), repo.events.all(), repo.feedback.all(), repo.concerts.all(), repo.weeks.all(), repo.explorations.all(),
  ])
  return libraryEntries(
    { works, recordings, programmes, comparisons, events, feedback, concerts, weeks, explorations },
    { hideSkipped: opts.hideSkipped, today: isoDateIn(new Date(), opts.timeZone) },
  )
}

/**
 * A composer's works as the Library files them: each work's title and facts,
 * its recordings — who played, where you stand, what you said, where to hear
 * it and where it came from — and the evenings it was heard live.
 */
export function LibraryWorks({ works }: { works: LibraryWorkEntry[] }) {
  return <>{works.map(({ work, recordings, live }) => {
    const again = [...recordings].reverse().find((r) => r.programmeId && r.itemId)
    // What, which number, when — one line; the fuller words are on the programme. A number the title already carries isn't said twice.
    const facts = compactFacts(work.form, catalogueNotInTitle(work.title, work.catalogue), work.composed)
    return (
      <div key={work.id} className={s.libraryWork}>
        {/* The title is the way back to hearing it with the app: the listening view of its latest programme,
            with the notes, what to listen for and when you heard it before — not only a bare Spotify link. */}
        <p className={s.libraryTitle}>
          {again ? <a className={s.quietLink} href={href({ name: 'listen', programmeId: again.programmeId!, itemId: again.itemId! })}>{curly(work.title)}</a> : curly(work.title)}
        </p>
        {facts && <p className={s.workMeta}>{facts}</p>}
        <ul className={s.libraryRecs}>
          {recordings.map(({ recordingId, rec, proposed, state, said, programmeId, programmeTitle, note }) => (
            <li key={recordingId} className={s.libraryRec}>
              {/* Who played it; then, on one row, where you stand with it, where to hear it and where it came from. */}
              <Credits r={proposed} />
              <span className={s.tagRow}>
                {/* Where you stand with it — said only once there is something to say. */}
                <StateTag state={state} />
                {said.reaction && <span className={s.tag}>{reactionLabel(said.reaction)}</span>}
                {rec && isConfirmed(rec) && <OpenInSpotify trackIds={rec.spotify.trackIds} durationMs={rec.spotify.durationMs} durationsMs={rec.spotify.trackDurationsMs} />}
                {(programmeId || note) && (
                  <span>
                    {note && <>{note}{programmeId ? ', ' : ''}</>}
                    {programmeId && <>from <a href={href({ name: 'programme', id: programmeId })} className={s.quietLink}>{programmeTitle}</a></>}
                  </span>
                )}
              </span>
              {said.notes.map((n, i) => <p key={i} className={s.said}><q>{n}</q></p>)}
            </li>
          ))}
        </ul>
        {live.map((c) => (
          <div key={c.id} className={s.libraryLive}>
            <p className={s.flush}>
              <span className={`${s.tag} ${s.tagOn}`}><Landmark size={12} strokeWidth={1.8} aria-hidden="true" /> heard live</span>{' '}
              <a href={href({ name: 'concert', id: c.id })} className={s.quietLink}>{c.venue}, {concertDate(c.date)}</a>
            </p>
            <Credits r={{ conductor: c.conductor, orchestra: c.orchestra, soloists: whoPlays(c, c.works.find((x) => x.workId === work.id) ?? { title: work.title, soloists: [] }) }} />
          </div>
        ))}
      </div>
    )
  })}</>
}
