import { Fragment } from 'react'
import type { Concert, Feedback, ListeningState, Programme, ProgrammeItem, ProgrammeOption, ProposedRecording } from '../domain/types'
import { curly } from '../domain/programmeStyle'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { heardAs, itemFeedback, playedProposed, standInPlayersOf, standInsOf } from '../domain/standIns'
import { displaySurname } from '../domain/identity'
import { isoDateIn, weekFromKey, weekOfDate } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { Landmark } from 'lucide-react'
import { seasonName } from '../domain/season'
import { journalWeek } from '../domain/journalWeek'
import { href } from '../app/router'
import { Empty, Problem, Waiting, madeWords } from '../components/common'
import { ConcertEntry } from '../components/ConcertEntry'
import s from '../styles/editorial.module.css'
import { StateTag } from '../components/WorkRows'
import { performerLine } from '../components/Credits'

// 'offered' says nothing the heading doesn't: a direction still on offer gets no tag.
const OPTION_WORD: Record<ProgrammeOption['status'], string> = {
  offered: '',
  chosen: 'chosen',
  open: 'left open',
  'taken-later': 'taken later',
  'set-aside': 'begun, then set aside',
  reworked: 'reworked for new settings',
}

/** A work as the Journal lists it: where it stands, who played, what was said. */
interface Listened {
  key: string
  item: ProgrammeItem
  state: ListeningState
  played: ProposedRecording
  said: ReturnType<typeof itemFeedback>
}

/**
 * The journal: every week so far, newest first — the three directions offered,
 * the one followed, and what was heard and said. Deliberately no totals, no time
 * listened, no streak. This page is memory, not measurement.
 */
export function JournalScreen() {
  const { repo, journey, settings } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const [weeks, options, events, feedback, programmes, comparisons, concerts] = await Promise.all([
      repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.comparisons.all(), repo.concerts.all(),
    ])
    // Concerts stand in the week they happened, with the hall's mark: live, not the week's programme.
    // One still to come wasn't heard: it waits on Live in Bucharest, not here.
    const today = isoDateIn(new Date(), settings.timeZone)
    const concertsIn = new Map<string, Concert[]>()
    for (const c of [...concerts].filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date))) {
      // A concert's date is already a calendar date: its week follows from it, whatever the time zone.
      const [y, m, d] = c.date.split('-').map(Number)
      const wk = weekOfDate({ year: y, month: m, day: d }).key
      concertsIn.set(wk, [...(concertsIn.get(wk) ?? []), c])
    }

    // A work stays in the week of the programme that offered it, however long
    // after it was played or spoken of: the week is when it was met. In running
    // order, where it stands now, a stand-in read as its item (domain/standIns.ts).
    const standIns = standInsOf(comparisons)
    const players = standInPlayersOf(comparisons)
    const listened = (p: Programme): Listened[] => p.sections.flatMap((x) => x.items).flatMap((item) => {
      const ids = heardAs(item, p.id, standIns)
      const state = listeningState(events, ids)
      if (state === 'not-started' || (settings.hideSkipped && state === 'skipped')) return []
      return [{ key: `${p.id}:${item.id}`, item, state, played: playedProposed(item, p.id, players, events, feedback), said: itemFeedback(feedback, ids, item.workId) }]
    })

    const programmeById = new Map(programmes.map((p) => [p.id, p]))
    // "More of this theme" and a sitting joined to the week, after the programme they continue.
    const companionsOf = new Map<string, Programme[]>()
    for (const p of [...programmes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (p.extends) companionsOf.set(p.extends, [...(companionsOf.get(p.extends) ?? []), p])
    }
    const withCompanions = (p: Programme) => [p, ...(companionsOf.get(p.id) ?? [])]
    const optionById = new Map(options.map((o) => [o.id, o]))
    const keys = [...new Set([...weeks.map((w) => w.weekKey), ...concertsIn.keys()])].sort((a, b) => b.localeCompare(a))
    return {
      entries: keys.map((key) => {
        const w = weeks.find((x) => x.weekKey === key)
        const { others, choice } = journalWeek(w, optionById, programmes)
        const main = w?.programmeId ? programmeById.get(w.programmeId) : undefined
        const setAside = (w?.setAsideProgrammeIds ?? []).map((id) => programmeById.get(id)).filter((p): p is Programme => Boolean(p))
        const all = [...(main ? withCompanions(main) : []), ...setAside.flatMap(withCompanions)]
        // One line a work: a work in both a programme set aside and the one that replaced it is listed once.
        const works = new Set<string>()
        const heard = all.flatMap(listened).filter(({ item }) => !works.has(item.workId) && Boolean(works.add(item.workId)))
        return { key, main, setAside, others, choice, listened: heard, concerts: concertsIn.get(key) ?? [] }
      }).filter((e) => e.main || e.setAside.length || e.others.length || e.concerts.length),
      feedback, companionsOf, concertCount: concerts.length, seasons: await journey.seasons(),
    }
  }, [settings.timeZone, settings.hideSkipped])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the journal…</Waiting>

  /** A programme of the week as a link, with the listener's last word on it as a whole. */
  const programmeLine = (p: Programme, lead: string, className: string) => {
    const said = lastWord(data.feedback, p.id)
    return (
      <Fragment key={p.id}>
        <p className={`${className} ${s.flush}`}>
          {lead}<a href={href({ name: 'programme', id: p.id })} className={s.quietLink}>{p.title}</a>
        </p>
        {said && <p className={`${s.said} ${s.flush}`}><q>{said}</q></p>}
      </Fragment>
    )
  }
  const companions = (p: Programme, className: string) =>
    (data.companionsOf.get(p.id) ?? []).map((x) => programmeLine(x, x.sitting ? `A sitting for tonight, ${madeWords(x.createdAt, settings.timeZone)}: ` : 'More of this theme: ', className))

  return (
    <div>
      <p className={s.eyebrow}>Journal</p>
      <h1 className={s.title}>The weeks so far</h1>
      <p className={s.dek}>What was offered, which way you went, and what stayed with you.</p>
      <p className={s.faint}>
        <Landmark size={15} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} />{' '}
        <a href={href({ name: 'concerts' })}>All concerts</a>{data.concertCount ? '' : ' — what you hear live, kept here too'} · <a href={href({ name: 'concert', id: 'new' })}>add one</a>
      </p>
      {data.seasons.map((x) => (
        <p key={x.number} className={s.faint}>
          <a href={href({ name: 'season', n: x.number })}>{seasonName(x.number)} in review</a> · {x.label}
        </p>
      ))}
      {data.entries.length === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing here yet. Your first week begins on This week.</Empty>}

      {data.entries.map(({ key, main, setAside, others, choice, listened, concerts }) => {
        const wk = weekFromKey(key)
        return (
          <section key={key} className={s.journalWeek} aria-label={`Week ${wk.number}, ${wk.isoYear}`}>
            {/* The week's number in the margin, a rule running down to the next:
                the journal reads as a timeline, not a feed. */}
            <div className={s.weekMark} aria-hidden="true">
              <span className={s.weekWord}>Week</span>
              <span className={s.weekNum}>{wk.number}</span>
            </div>
            <div className={s.weekBody}>
            <h2 className={s.weekHead}>{wk.label}</h2>
            {main && programmeLine(main, '', s.entryTitle)}
            {main && companions(main, s.quiet)}
            {setAside.map((p) => (
              <Fragment key={p.id}>
                {programmeLine(p, 'set aside: ', s.faint)}
                {companions(p, s.faint)}
              </Fragment>
            ))}
            {choice && choice.kind !== 'chosen' && (
              <p className={`${s.faint} ${s.flush} ${s.mt3xs}`}>
                {choice.kind === 'path' ? `Took a path from the week of ${weekFromKey(choice.fromWeek).label}` : 'A sitting for tonight'}
              </p>
            )}

            {/* The week in parts, each under its own small heading: what else was offered, what was heard live, what was listened to. */}
            {others.length > 0 && (
              <div className={s.journalPart}>
                <h3 className={s.journalPartHead}>{choice?.kind === 'chosen' ? 'Also offered' : 'Offered'}</h3>
                <ul className={s.offeredList} aria-label={choice?.kind === 'chosen' ? 'Also offered this week' : 'Offered this week'}>
                  {others.map((o) => (
                    <li key={o.id}>
                      <span className={s.quiet}>{o.title}</span>{' '}
                      {OPTION_WORD[o.status] && <span className={s.tag}>{OPTION_WORD[o.status]}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {concerts.length > 0 && (
              <div className={s.journalPart}>
                <h3 className={s.journalPartHead}><Landmark size={15} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> Heard live</h3>
                {concerts.map((c) => <ConcertEntry key={c.id} concert={c} />)}
              </div>
            )}
            {listened.length > 0 && (
              <div className={s.journalPart}>
                <h3 className={s.journalPartHead}>What you listened to</h3>
                {/* One line a work, like a concert's: who wrote it, what, who played; then where it stands and what was said. */}
                <ul className={`${s.concertWorkList} ${s.listenedList}`}>
                  {listened.map(({ key, item, state, played, said }) => {
                    // Commas inside the line: it already sits after a " · ".
                    const who = performerLine(played, ', ')
                    return (
                      <li key={key}>
                        <a href={href({ name: 'composer', composer: item.proposed.composer })} className={s.composerLink}>{displaySurname(item.proposed.composer)}</a>, <em>{curly(item.proposed.work)}</em>
                        {who && <span className={s.faint}> · {who}</span>}{' '}
                        <StateTag state={state} />
                        {said.reaction && <>{' '}<span className={s.tag}>{reactionLabel(said.reaction)}</span></>}
                        {said.notes.map((n, i) => <p key={i} className={s.said}><q>{n}</q></p>)}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** The listener's latest note on a programme as a whole (feedback on the programme itself). */
function lastWord(all: Feedback[], programmeId: string): string | undefined {
  const notes = latestFeedback(all.filter((f) => f.target.type === 'programme'), programmeId).notes
  return notes[notes.length - 1]
}
