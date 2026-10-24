import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ComposerLink } from './Composer'
import { GoingCards, GoingToggle, useGoings } from '../components/Going'
import { Gloss } from '../components/Gloss'
import { Headphones } from 'lucide-react'
import type {
  Comparison, Explanation, Feedback, ListeningEvent, Programme, ProgrammeItem, ProgrammeOption, Recording, Resource, Theme, ThemeExploration, WeekRecord, Work,
} from '../domain/types'
import { latestFeedback, listeningState } from '../domain/listening'
import { isoDateIn, sinceWords, weekFromKey } from '../domain/week'
import { catalogueLine, whatAndWhen } from '../domain/workFacts'
import { sectionTitle } from '../domain/sections'
import { movementTitles, primeMinutes, roman, curly } from '../domain/programmeStyle'
import { programmeCreditRows } from '../components/Credits'
import { liveEvents, liveMatches, venueShort, whatIsOnAt, type LiveConcert } from '../live/live'
import type { Repo } from '../store/repo'
import { useLoad, useServices } from '../app/services'
import { go, href, workAnchor } from '../app/router'
import { aboutDuration, isConfirmed, keepPlaylistCurrent, saveProgrammePlaylist, spotifyCandidates, needsLook, verifyProgramme, type PlaylistMark } from '../spotify/verify'
import { onPlayerReading, positionOf, usePlayerState } from '../app/playback'
import { playbackOf } from '../spotify/client'
import { useOnline } from '../app/online'
import { RecordingBlock } from '../components/RecordingBlock'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { CharCount, MAX_ASK, NeedsKey, Paragraphs, Problem, Waiting, messageOf, madeWords, webUrl } from '../components/common'
import { SittingCard } from '../components/SittingCard'
import { OpenPaths } from '../components/OpenPaths'
import { Twisty } from '../components/Twisty'
import { ListeningRow, MoreContextRow, type StateChoice } from '../components/WorkRows'
import { heardAs, standInPlayersOf, standInsOf } from '../domain/standIns'
import { BackupNudge } from '../components/BackupNudge'
import { EveningMark, eveningWords } from '../components/Evening'
import { eveningSeed, isOwnEvening, threadMembers } from '../domain/evenings'
import { useFollow } from '../app/follow'
import s from '../styles/editorial.module.css'
import { useTitle } from '../app/title'
import { whenWords } from '../domain/going'
import { passing } from '../curation/api'
import { inLanguage } from '../domain/types'

interface Bundle {
  programme: Programme
  theme?: Theme
  exploration?: ThemeExploration
  firstExploration?: ThemeExploration
  week?: WeekRecord
  otherOptions: ProgrammeOption[]
  comparisons: Comparison[]
  /** Each item's stand-in, where Spotify lacked the curator's recording (domain/standIns.ts). */
  standIns: Map<string, string>
  recordings: Map<string, Recording>
  works: Map<string, Work>
  events: ListeningEvent[]
  feedback: Feedback[]
  resources: Resource[]
  resourcesSearched: boolean
  explanations: Map<string, Explanation>
  playlist?: PlaylistMark
  /** The week's main programme when this one is "more of this theme" or a sitting. */
  root?: Programme
  /** The thread's members (domain/evenings.ts): a sitting outside them is an evening of its own. */
  members: Set<string>
  /** "More of this theme" programmes made for the week's programme. */
  extensions: Programme[]
  /** Paths offered in earlier weeks and still open, newest first. */
  openPaths: ProgrammeOption[]
  /** Side-by-side pairs are the listener's choice (Settings → Same work, two perspectives). */
  pairs: boolean
}

async function loadBundle(repo: Repo, id: string): Promise<Bundle> {
  const programme = await repo.programmes.require(id)
  const [theme, exploration, week, events, feedback, allResources, searched, playlistMark] = await Promise.all([
    repo.themes.get(programme.themeId),
    repo.explorations.get(programme.explorationId),
    repo.weeks.get(programme.weekKey),
    repo.events.all(),
    repo.feedback.all(),
    repo.resources.all(),
    repo.marks.get(`resources:${id}`),
    repo.marks.get(`playlist:${id}`),
  ])
  const items = programme.sections.flatMap((x) => x.items)
  const onRequest = await repo.comparisons.many(items.map((i) => `cmp:${id}:${i.id}`))
  const comparisons = [...(await repo.comparisons.many(programme.comparisonIds)), ...onRequest]
  const recIds = [...items.map((i) => i.recordingId), ...comparisons.flatMap((c) => c.perspectives.map((p) => p.recordingId))]
  const recordings = new Map((await repo.recordings.many(recIds)).map((r) => [r.id, r]))
  const works = new Map((await repo.works.many([...new Set(items.map((i) => i.workId))])).map((w) => [w.id, w]))
  // Written in another language than the curator writes in now: left out, so "More context" offers it afresh.
  const { language } = await repo.preferences()
  const explanations = new Map((await repo.explanations.many(items.map((i) => `${id}:${i.id}`))).filter((e) => inLanguage(e, language)).map((e) => [e.id.split(':').pop()!, e]))
  const explorations = theme ? await repo.explorations.many(theme.explorationIds) : []
  // The week's other directions — the latest three and any asked for before them, which were dropped
  // from view here once three new ones came, though they were still open.
  const otherOptions = week
    ? (await repo.options.many([...week.optionIds, ...(week.earlierOptionIds ?? [])])).filter((o) => o.id !== week.chosenOptionId && (o.status === 'offered' || o.status === 'open'))
    : []
  const rootId = programme.extends ?? programme.id
  const allProgrammes = await repo.programmes.all()
  const root = programme.extends ? allProgrammes.find((x) => x.id === programme.extends) : undefined
  const extensions = allProgrammes.filter((x) => x.extends === rootId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  // The same paths, in the same order, as This week lists them.
  const openPaths = (await repo.options.all())
    .filter((o) => o.status === 'open' && o.weekKey < programme.weekKey)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
  return {
    programme, theme, exploration, week, otherOptions, comparisons, standIns: standInsOf(comparisons), recordings, works, events, feedback,
    firstExploration: explorations.sort((a, b) => a.weekKey.localeCompare(b.weekKey))[0],
    resources: allResources.filter((r) => r.programmeId === id),
    resourcesSearched: Boolean(searched),
    explanations,
    playlist: playlistMark?.value as PlaylistMark | undefined,
    root,
    extensions,
    members: threadMembers(exploration ? [exploration] : []),
    openPaths,
    pairs: (await repo.preferences()).pairs,
  }
}

export function ProgrammeScreen({ id, asThisWeek = false }: { id: string; asThisWeek?: boolean }) {
  const { repo } = useServices()
  const { data, error, loading, retry } = useLoad(() => loadBundle(repo, id), [id])
  useTitle(asThisWeek ? 'This week' : data?.programme.title)
  // Shown as This week itself, a link to "This week" would only lead back here: point to the Journal instead.
  const notFound = asThisWeek
    ? { text: 'This week’s programme can’t be found — perhaps it was cleared. The Journal keeps every week.', link: { href: href({ name: 'journal' }), label: 'Journal' } }
    : { text: 'There’s no such programme — perhaps an old link, or one from a journey started afresh.', link: { href: href({ name: 'week' }), label: 'This week' } }
  if (error) return <Problem error={error} onRetry={retry} notFound={notFound} />
  if (!data) return loading ? <Waiting>Opening the programme…</Waiting> : null
  return <ProgrammeView b={data} key={id} />
}

/**
 * What each kind of section is for, in the week's sequence — the curator
 * names the role, the heading is its own; this line says where you are.
 */
const ROLE_GUIDE: Record<string, string> = {
  start: 'where the week begins: the piece the rest is heard against.',
  then: 'the next step on from there.',
  context: 'background: music that shows where the rest came from.',
  contrast: 'a change of light, chosen to push against what came before.',
  compare: 'the same idea from another angle.',
  deeper: 'further in, for when the first pieces have settled.',
  coda: 'a close to the week.',
}
const PAIR_GUIDE = 'One work in two recordings, side by side. Hear both: the difference between them is the point.'
const FURTHER_GUIDE = 'Optional: notes, essays, talks and filmed performances found for this programme.'

function stageWords(stage: number): string {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'][stage] ?? `${stage}th`
}

export function ProgrammeView({ b }: { b: Bundle }) {
  const { journey, spotify, repo, bump, say, week, curatorReady, settings } = useServices()
  const { programme: p } = b
  // With "hide what I skip" on, skipped works step out of the page — shown again, for now, on request.
  const [showSkipped, setShowSkipped] = useState(false)
  const skippedIds = new Set(p.sections.flatMap((x) => x.items).filter((i) => listeningState(b.events, itemRecordingIds(b, i)) === 'skipped').map((i) => i.id))
  const hiding = settings.hideSkipped && !showSkipped
  const shown = (item: ProgrammeItem) => !hiding || !skippedIds.has(item.id)
  // This week's programme — or "more of this theme" made for it.
  const isCurrent = p.weekKey === week.key && (b.week?.programmeId === p.id || (Boolean(p.extends) && b.week?.programmeId === p.extends))
  const setAside = b.week?.setAsideProgrammeIds.includes(p.id)
  // Confirm the programme's recordings on Spotify, quietly, a few at a time.
  // Then, once, the listening companion's notes for what's confirmed (the cheaper model, one call).
  useEffect(() => {
    void verifyProgramme(repo, spotify, b.programme.id, bump)
      .then(() => (curatorReady ? journey.companion(b.programme.id) : 0))
      .then((n) => { if (n) bump() })
      .catch(() => {})
  }, [b.programme.id, b.comparisons.length, spotify, repo, bump, curatorReady, journey])

  // This week's programme gathers its further reading once, by itself.
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    // Only the week's own programme searches by itself; "more of this theme" has a button (each search costs a little).
    if (!isCurrent || p.extends || b.resourcesSearched || searching) return
    setSearching(true)
    journey.resources(p.id).then(() => bump()).catch(() => {}).finally(() => setSearching(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent, b.resourcesSearched, p.id])

  const own = isOwnEvening(p, b.members)
  const first = b.firstExploration
  // An evening of its own is no visit to the thread: it isn't told as a return to it.
  const returning = !own && p.stage > 1 && first
  const shownItems = p.sections.flatMap((x) => x.items).filter(shown)
  // With two works or more the running order heads the music and says how long it runs; with one, the tools line does.
  const ordered = shownItems.length >= 2
  const length = lengthOf(b, shownItems)
  const needsSpotify = needsSpotifyNote(b, spotify.connected)
  // Which part each shown work sits in, for the running head: "II · Where it leads".
  const partOf = new Map(p.sections.filter((section) => section.items.some(shown)).flatMap((section, i) =>
    section.items.map((item) => [item.id, `${roman(i + 1)} · ${sectionTitle(section)}`] as [string, string])))

  return (
    // One page however it was reached ("#/" as This week, "#/p/<id>" from the Journal): the folds opened on it are kept under this name.
    <article data-page={`programme:${p.id}`}>
      <p className={s.eyebrow}>
        {own && <><EveningMark />{' '}</>}
        {p.sitting && p.extends
          ? `${own ? 'An evening of its own' : 'A sitting beside this week’s theme'} · ${p.sitting.hours === 1 ? 'about an hour' : 'about two hours'} · ${madeWords(p.createdAt, settings.timeZone)}`
          : p.sitting ? `A sitting for tonight · ${p.sitting.hours === 1 ? 'about an hour' : 'about two hours'} · ${madeWords(p.createdAt, settings.timeZone)}`
            : p.extends ? 'More of this week’s theme' : isCurrent ? 'This week’s programme' : setAside ? 'Set aside' : 'From the journal'}
        {/* The masthead already dates this week; an earlier week's programme says which it was. */}
        {p.weekKey !== week.key && ` · ${weekFromKey(p.weekKey).label}`}
      </p>
      {b.root && (p.sitting
        ? <EveningPlace p={p} root={b.root} own={own} />
        : <p className={s.quiet}>Continues <a href={href({ name: 'programme', id: b.root.id })}>{b.root.title}</a>.</p>)}
      <h1 className={s.title}>{p.title}</h1>
      {p.dek && <p className={s.dek}>{p.dek}</p>}
      <AlsoThisWeek extensions={b.extensions} members={b.members} current={p.id} isCurrent={isCurrent} timeZone={settings.timeZone} />
      {isCurrent && !p.extends && <BackupNudge />}

      {returning && (
        <div className={s.continuity}>
          <p className={s.eyebrow}>A returning thread · {stageWords(p.stage)} visit · first explored {sinceWords(first.weekKey, p.weekKey)}</p>
          {p.continuityNote && <p className={s.flush}>{p.continuityNote}</p>}
          {/* Where the earlier visits are told: the thread's own entry, its questions and where it could go. */}
          <p className={`${s.faint} ${s.mtSm} ${s.mb0}`}><a href={href({ name: 'threads' })} className={s.quietLink}>The thread so far</a></p>
        </div>
      )}

      <ProgrammeTools b={b} showLength={!ordered} />
      {isCurrent && <LiveLine b={b} skip={settings.hideSkipped ? skippedIds : undefined} />}
      {ordered ? <RunningOrder b={b} shown={shown} spotifyNote={needsSpotify} isCurrent={isCurrent} /> : needsSpotify && <SpotifyNote />}
      {settings.hideSkipped && skippedIds.size > 0 && (
        <p className={s.faint}>
          {showSkipped ? `Showing ${skippedIds.size} skipped ${skippedIds.size === 1 ? 'work' : 'works'}. ` : `${skippedIds.size} skipped ${skippedIds.size === 1 ? 'work' : 'works'} hidden. `}
          <button className={s.textButton} onClick={() => setShowSkipped(!showSkipped)}>{showSkipped ? 'Hide again' : 'Show'}</button>
        </p>
      )}

      <hr className={s.rule} />
      <Paragraphs text={p.introduction} className={s.lede} />

      {/* Read once: open the first time this programme is opened, folded on every visit after,
          so the running order isn't pushed down by what's already been read. */}
      {(p.whyNow || p.historicalPlace || p.howTheyRelate) && (
        <Twisty label="The background" value="why now · where it sits · how they connect" readOnce={`background:${p.id}`}>
          <div className={s.asides}>
            {p.whyNow && <div className={s.aside}><h2 className={s.h3}>Why this, now</h2><p>{p.whyNow}</p></div>}
            {p.historicalPlace && <div className={s.aside}><h2 className={s.h3}>Where it sits</h2><p>{p.historicalPlace}</p></div>}
            {p.howTheyRelate && <div className={s.aside}><h2 className={s.h3}>How they connect</h2><p>{p.howTheyRelate}</p></div>}
          </div>
        </Twisty>
      )}

      <PinnedWork items={shownItems} parts={partOf} />
      {p.sections.filter((section) => section.items.some(shown)).map((section, i) => {
        const items = section.items.filter(shown)
        // A pulled line only where a part runs to two works or more: taken from the first work's
        // notes and set after that work, so it echoes from a distance, never beside its own sentence.
        return (
        <section key={section.id} aria-label={sectionTitle(section)} className={s.part}>
          {/* Between parts, a fleuron: the one place the page asks for a pause. */}
          {i > 0 && <p className={s.fleuron} aria-hidden="true"><span /></p>}
          {/* Each part is named as a programme names its movements: a numeral, then the title. */}
          <h2 className={`${s.sectionHead} ${s.partHead}`}><span className={s.partNumeral}>{roman(i + 1)}</span>{sectionTitle(section)}</h2>
          {/* What the part is for; its place ("the second of three") is the numeral's job, and the running order's. */}
          {ROLE_GUIDE[section.role] && <p className={s.sectionGuide}>{ROLE_GUIDE[section.role].charAt(0).toUpperCase() + ROLE_GUIDE[section.role].slice(1)}</p>}
          {section.note && <p className={s.sectionNote}>{section.note}</p>}
          {items.map((item) => (
            <Fragment key={item.id}>
              <ItemView
                item={item}
                number={shownItems.findIndex((i) => i.id === item.id) + 1}
                b={b}
                comparison={b.comparisons.find((c) => c.id === `cmp:${p.id}:${item.id}`)}
              />
              {/* One line of the part set large, as a booklet pulls a quotation: a landing place on a
                  long page. It repeats the notes above, so a screen reader skips it. */}
            </Fragment>
          ))}
        </section>
        )
      })}

      {b.comparisons.filter((c) => c.origin === 'programme').map((c) => (
        <section key={c.id} aria-label="Two perspectives">
          <h2 className={s.sectionHead}>Same work, two perspectives</h2>
          <p className={s.sectionGuide}>{PAIR_GUIDE}</p>
          <ComparisonView c={c} b={b} />
        </section>
      ))}

      {/* The music ends here: an ornament and one line close it, as a printed programme closes on its
          last work. What follows — further reading, where next — is the back of the booklet. */}
      {shownItems.length > 0 && (
        <p className={s.musicClose}>
          That’s the {p.sitting ? 'evening' : 'week'}: {shownItems.length} {shownItems.length === 1 ? 'work' : 'works'}{length.all ? `, ${aboutDuration(length.total)}` : ''}.
        </p>
      )}
      {shownItems.length > 0 && <Colophon b={b} items={shownItems} />}

      <ResourcesView b={b} searching={searching} onSearch={async () => {
        setSearching(true)
        try { await journey.resources(p.id, { again: b.resourcesSearched }); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setSearching(false) }
      }} />

      <WhereNext b={b} isCurrent={Boolean(isCurrent)} />
    </article>
  )
}

/** A work's recordings as listening knows them: the curator's, and the stand-in that plays where Spotify lacks it. */
const itemRecordingIds = (b: Bundle, item: ProgrammeItem): string[] => heardAs(item, b.programme.id, b.standIns)

/**
 * The recording that plays for an item: the curator's, once Spotify has
 * confirmed it; otherwise its stand-in's, if that is confirmed; otherwise none.
 * The programme's length, its playlist and "the music runs" count this.
 */
function playableOf(b: Bundle, item: ProgrammeItem): Recording | undefined {
  return itemRecordingIds(b, item).map((id) => b.recordings.get(id)).find(isConfirmed)
}

/** How long a work runs, as it plays (playableOf); undefined until Spotify has confirmed a recording of it. */
const durationOf = (b: Bundle, item: ProgrammeItem): number | undefined => playableOf(b, item)?.spotify?.durationMs || undefined

/** How long these works run together: the total of those known, how many are known, and whether that is all of them. */
function lengthOf(b: Bundle, items: ProgrammeItem[]): { total: number; known: number; all: boolean } {
  const known = items.map((i) => durationOf(b, i)).filter((ms): ms is number => Boolean(ms))
  return { total: known.reduce((n, ms) => n + ms, 0), known: known.length, all: known.length > 0 && known.length === items.length }
}

/**
 * Without Spotify, no recording on the page can be confirmed: said once, under
 * the running order, rather than under every work. Only while some recording
 * is still waiting for that — one Spotify has a near match for, or lacks, has
 * its own word in its block.
 */
function needsSpotifyNote(b: Bundle, connected: boolean): boolean {
  if (connected) return false
  return [...b.recordings.values()].some((r) => !isConfirmed(r) && r.verification !== 'not-found' && !(r.verification === 'unconfirmed' && r.spotify))
}

function SpotifyNote() {
  return <p className={s.note}>Connect Spotify in <a href={href({ name: 'settings' })}>Settings</a> to confirm the exact recordings.</p>
}

/**
 * A slim line pinned to the top of the screen while you read inside a work
 * whose header has scrolled away: "6 · Arnold Bax — Tintagel". A long work
 * runs to several screens of notes, panels and pairs, and without it the
 * middle of one looks like the middle of any other. Tapping it goes back to
 * the work's start. Gone between works and above the first.
 */
function PinnedWork({ items, parts }: { items: ProgrammeItem[]; parts: Map<string, string> }) {
  const [current, setCurrent] = useState<number>(-1)
  const ids = items.map((i) => i.id).join('|')
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      setCurrent(items.findIndex((item) => {
        const el = document.getElementById(workAnchor(item.id))
        const head = el?.querySelector('[data-work-head]')
        // The header is above the screen and enough of the work is still on it to be "in" it.
        return Boolean(el && head && head.getBoundingClientRect().bottom < 0 && el.getBoundingClientRect().bottom > 72)
      }))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    check()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])
  const item = items[current]
  if (!item) return null
  return (
    <button
      type="button"
      className={s.pinnedWork}
      onClick={() => document.getElementById(workAnchor(item.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      aria-label={`Back to the start of ${item.proposed.work}`}
    >
      {/* A running head, as a booklet's page carries one: the part above, the work beneath. */}
      {parts.get(item.id) && <span className={s.pinnedPart}>{parts.get(item.id)}</span>}
      <span className={s.pinnedInner}>
        <span className={s.pinnedNo}>{current + 1}</span>
        <span className={s.pinnedText}>{item.proposed.composer} — <em>{curly(item.proposed.work)}</em></span>
      </span>
    </button>
  )
}

/**
 * The back page: who wrote the notes and for which week, then the recordings,
 * one to a line, as a printed programme closes on its credits. Each is the
 * recording that plays — a stand-in's, where Spotify lacked the curator's.
 */
function Colophon({ b, items }: { b: Bundle; items: ProgrammeItem[] }) {
  const p = b.programme
  const players = standInPlayersOf(b.comparisons)
  const performers = (item: ProgrammeItem) => {
    const playing = playableOf(b, item)
    const proposed = playing && playing.id !== item.recordingId ? players.get(`cmp:${p.id}:${item.id}`)?.proposed ?? item.proposed : item.proposed
    return programmeCreditRows(proposed).map(([name]) => name).join(', ')
  }
  return (
    <footer className={s.colophon} aria-label="Colophon">
      <p className={s.colophonLine}>Programme notes by the curator · {p.sitting ? 'a sitting for tonight, ' : ''}{weekFromKey(p.weekKey).label}</p>
      <p className={s.colophonHead}>The recordings</p>
      <ol className={s.colophonList}>
        {items.map((item) => (
          <li key={item.id}><em>{curly(item.proposed.work)}</em>{performers(item) ? ` — ${performers(item)}` : ''}</li>
        ))}
      </ol>
    </footer>
  )
}

const STATE_TAG: Record<string, string> = { listening: 'started', heard: 'heard', skipped: 'skipped' }

/**
 * The week's music at a glance, before the essay: every work in order, with
 * when it was written, how long it runs, and where you stand with it. On a phone the essay is two screens long, and this
 * is what makes the music findable without scrolling past it. Each line jumps
 * to its work (by scrolling — the URL hash belongs to the router).
 */
function RunningOrder({ b, shown, spotifyNote, isCurrent }: { b: Bundle; shown: (item: ProgrammeItem) => boolean; spotifyNote: boolean; isCurrent: boolean }) {
  const player = usePlayerState()
  const { settings, week } = useServices()
  const rows = b.programme.sections.flatMap((section) => section.items.filter(shown).map((item) => ({ item, section })))
  // The part's numeral, counted as the page counts its parts: only those with a work shown.
  const parts = b.programme.sections.filter((section) => section.items.some(shown)).map((section) => section.id)
  const partNo = (id: string) => parts.indexOf(id) + 1
  // How long it runs is said here, once (the tools line keeps it only when there is no running order).
  // Partly known, it says how many it counts: a total of two works must not read as the week's.
  const length = lengthOf(b, rows.map(({ item }) => item))
  const lengthWords = length.known === 0 ? '' : length.all ? ` · ${aboutDuration(length.total)}` : ` · ${aboutDuration(length.total)} for the ${length.known} confirmed`
  const jump = (id: string) => document.getElementById(workAnchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // The work Spotify is on now, if it's one of these, is marked in the list.
  const onNow = (rid: string) => {
    const r = b.recordings.get(rid)
    return isConfirmed(r) ? positionOf(player.np, r.spotify.trackIds) : null
  }
  // Where you are mid-week: once something has been begun, the first work not yet heard (nor skipped, nor
  // sounding now) is marked "next" — the place to pick up from, found at a glance on a long page.
  const states = rows.map(({ item }) => listeningState(b.events, itemRecordingIds(b, item)))
  const begun = states.some((st) => st !== 'not-started')
  const nextAt = begun ? rows.findIndex(({ item }, n) => (states[n] === 'not-started' || states[n] === 'listening') && !itemRecordingIds(b, item).some((rid) => onNow(rid))) : -1
  // The week's last days, said once: Saturday "ends tomorrow", Sunday "ends tonight".
  const today = isoDateIn(new Date(), settings.timeZone)
  const endsSoon = isCurrent && states.some((st) => st === 'not-started' || st === 'listening')
    ? (today === week.endsOn ? 'The week ends tonight' : addDays(today, 1) === week.endsOn ? 'The week ends tomorrow' : null)
    : null
  const toWhereNext = () => document.getElementById(WHERE_NEXT)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className={s.runningOrder} aria-label="This week’s music">
      <p className={s.panelHead}>
        {`The music · ${rows.length} works${lengthWords}`}
      </p>
      {spotifyNote && <SpotifyNote />}
      {/* Grouped by section, each under its heading: the part of the week a
          work belongs to is said once above it, not in the space a state tag
          needs — where it used to vanish as soon as each work had a state. */}
      <ol className={s.roList}>
        {rows.map(({ item, section }, n) => {
          const state = listeningState(b.events, itemRecordingIds(b, item))
          const now = itemRecordingIds(b, item).map(onNow).find(Boolean) ?? null
          const firstOfSection = n === 0 || rows[n - 1].section.id !== section.id
          // When it was written (the curator's date for the work) and how long it runs, where known.
          const meta = [b.works.get(item.workId)?.composed?.trim(), primeMinutes(durationOf(b, item))].filter(Boolean).join(' · ')
          return (
            <li key={item.id} aria-current={now ? 'true' : undefined}>
              {firstOfSection && <p className={s.roGroup}><span className={s.partNumeral}>{roman(partNo(section.id))}</span>{sectionTitle(section)}</p>}
              <button type="button" className={s.roRow} onClick={() => jump(item.id)}>
                <span className={s.roNo}>{n + 1}</span>
                <span className={s.roText}>
                  <span className={s.roComposer}>{item.proposed.composer}</span>
                  <span className={s.roWork}>{curly(item.proposed.work)}</span>
                  {meta && <span className={s.roMeta}>{meta}</span>}
                </span>
                <span className={s.roSide}>
                  {now
                    ? <span className={`${s.tag} ${s.tagOn}`}>{now.playing ? 'playing' : 'paused'}</span>
                    : n === nextAt
                    ? <span className={`${s.tag} ${s.tagNext}`}>{state === 'listening' ? 'pick up' : 'next'}</span>
                    : STATE_TAG[state]
                    ? <span className={`${s.tag} ${state === 'heard' ? s.tagOn : ''}`}>{STATE_TAG[state]}</span>
                    : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {/* The ways on — a sitting, more of the theme, how it went — are at the foot of a long page: one tap down. */}
      {isCurrent && (
        <p className={s.roFoot}>
          {endsSoon && <>{endsSoon} — what isn’t heard stays in the Journal. </>}
          <button type="button" className={`${s.textButton} ${s.inlineButton}`} onClick={toWhereNext}>Where next ↓</button>
        </p>
      )}
    </nav>
  )
}

/** The anchor of "Where next", for the running order's way down to it. */
const WHERE_NEXT = 'where-next'

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function ItemView({ item, number, b, comparison }: { item: ProgrammeItem; number: number; b: Bundle; comparison?: Comparison }) {
  const { journey, bump, say, spotify, curatorReady } = useServices()
  const pid = b.programme.id
  const state = listeningState(b.events, itemRecordingIds(b, item))
  const recording = b.recordings.get(item.recordingId)
  const [explaining, setExplaining] = useState(false)
  const [comparing, setComparing] = useState(false)
  const explanation = b.explanations.get(item.id)
  const work = b.works.get(item.workId)
  // What it is and when, in words; the catalogue number translated beneath it.
  const whatWhen = whatAndWhen(work?.form, work?.composed)
  const catalogue = catalogueLine(work?.catalogue ?? item.proposed.catalogue, item.proposed.composer)
  // How long it runs, as a programme prints it, and its movements — both only once Spotify has confirmed the recording that plays.
  const duration = primeMinutes(durationOf(b, item))
  const movements = movementTitles(playableOf(b, item)?.spotify?.trackNames)

  // Sounding on Spotify while nothing at all is recorded of it (resumed, or started in Spotify itself):
  // what is playing is the truth — recorded once as begun, as a tap on Play would have. Only from a real
  // reading (never the state shown the moment Play is tapped, which Play itself records), and never over
  // anything the listener said: a "Not started" they chose stands.
  const sounding = playableOf(b, item)
  const nothingRecorded = !b.events.some((e) => itemRecordingIds(b, item).includes(e.recordingId))
  const notedStart = useRef(false)
  const latestStart = useRef({ sounding, nothingRecorded })
  latestStart.current = { sounding, nothingRecorded }
  useEffect(() => onPlayerReading((np) => {
    const { sounding: rec, nothingRecorded: fresh } = latestStart.current
    if (!rec?.spotify || !fresh || notedStart.current || !playbackOf(np, rec.spotify.trackIds)?.playing) return
    notedStart.current = true
    void journey.markListening({ recordingId: rec.id, workId: item.workId }, 'play-started', pid, 'app').then(bump, () => {})
  }), [journey, item.workId, pid, bump])

  // Once per tap, like "I’ve heard it" in the listening view: a ref, since two
  // taps in one frame both see the state as it was before either was kept.
  const writing = useRef(false)
  async function once(write: () => Promise<unknown>) {
    if (writing.current) return
    writing.current = true
    try {
      await write()
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      writing.current = false
    }
  }

  function mark(to: StateChoice) {
    // Tapping where you already are says nothing new: recording it again would
    // add a second "heard" (or a reset) to the listening the curator reads.
    if (to.value === state) return
    return once(() => journey.markListening({ ...item, recordingId: playedId }, to.kind, pid))
  }

  const knewIt = Boolean(latestFeedback(b.feedback, item.workId).known)
  const toggleKnown = () => once(() => journey.markKnown(item.workId, !knewIt, pid))

  async function explain() {
    setExplaining(true)
    try { await journey.explain(pid, item.id); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setExplaining(false) }
  }

  /** True once the curator has been asked and answered (or Spotify truly has nothing, or asking again would fail the same way); false when a later try may succeed. */
  async function compare(mustBeOnSpotify = false, quiet = false): Promise<boolean> {
    setComparing(true)
    try {
      // A stand-in is chosen from what Spotify really has, never from memory alone.
      const candidates = mustBeOnSpotify && spotify.connected ? await spotifyCandidates(spotify, item.proposed) : undefined
      if (mustBeOnSpotify && candidates && candidates.length === 0) {
        if (!quiet) say('Spotify has no recording of this work that the app could find.')
        return true
      }
      await journey.compare(pid, item.id, { mustBeOnSpotify, spotifyCandidates: candidates })
      bump()
      return true
    } catch (e) {
      if (!quiet) say(messageOf(e), 'danger')
      return !passing(e)
    } finally {
      setComparing(false)
    }
  }

  // When Spotify truly lacks the curator's recording, find one it has, once, by itself.
  const missing = recording?.verification === 'not-found' && !needsLook(recording)
  const askedForStandIn = useRef(false)
  const online = useOnline()
  useEffect(() => {
    if (!missing || comparison?.standIn || !spotify.connected || !curatorReady || !online || askedForStandIn.current) return
    askedForStandIn.current = true
    // A request that failed in passing (offline, the curator busy) is asked again when things change; one that
    // failed on its merits (no answer that would validate) is not re-paid on every visit — the listener can tap.
    void compare(true, true).then((ok) => { if (!ok) askedForStandIn.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, comparison, spotify.connected, curatorReady, online])
  const standIn = comparison?.standIn ? comparison : undefined
  // What is reacted to is the recording that plays: the stand-in's own, where Spotify lacks the curator's.
  const playedId = standIn && !isConfirmed(recording) && standIn.perspectives[1] ? standIn.perspectives[1].recordingId : item.recordingId
  // Heard, and nothing said yet about the recording that played: the question is put, open.
  const feedbackPending = state === 'heard' && !b.feedback.some((f) => f.target.id === playedId)

  const standInShown = Boolean(standIn) && !isConfirmed(recording)
  // The way most listening happens: the work on a screen of its own, while it plays — set like
  // Play (the same shape and height), outlined so Play stays first, and plainly a way to another screen.
  // It sits straight under the Play that plays: the stand-in's, where there is one.
  const listenAlong = (
    <div className={s.listenAlongRow}>
      <a className={s.listenAlong} href={href({ name: 'listen', programmeId: pid, itemId: item.id })}>
        <Headphones size={16} strokeWidth={1.8} aria-hidden="true" />Listen along<span aria-hidden="true">→</span>
      </a>
      {/* What it can follow depends on a recording Spotify has confirmed: without one, the notes and questions still work. */}
      <span className={s.listenAlongNote}>{playableOf(b, item) ? 'the movements, notes and questions as it plays' : 'notes and questions to read alongside'}</span>
    </div>
  )

  return (
    <div className={s.item} id={workAnchor(item.id)}>
      <header className={s.workHead} data-work-head="">
        {/* The duration where a programme prints it: at the end of the line, across from the composer. */}
        <p className={`${s.composer} ${s.workHeadLine}`}>
          <span className={s.workHeadWho}><span className={s.itemNo}>{number}</span><ComposerLink name={item.proposed.composer} /></span>
          {duration && <span className={s.workDuration}>{duration}</span>}
        </p>
        <h3 className={s.work}>{curly(item.proposed.work)}</h3>
        {whatWhen && <p className={s.workMeta}>{whatWhen}</p>}
        {catalogue && <p className={s.workCatalogue}>{catalogue}</p>}
        {/* The movements, as the programme lists them under the title — this recording's own, as its album divides them. */}
        {movements.length > 0 && (
          <ol className={s.workMovements} aria-label="Movements">
            {movements.map((m, i) => <li key={i}><span className={s.movementNumeral}>{m.numeral}.</span> <em>{m.title}</em></li>)}
          </ol>
        )}
      </header>

      {/* The notes open as a booklet's essays do: their first line in small capitals. */}
      <div className={`${s.prose} ${s.workWhy} ${s.mtSm}`}><p><Gloss text={item.why} /></p></div>
      {item.revisitReason && <p className={`${s.continuity} ${s.flush} ${s.mtSm} ${s.mbSm}`}>{item.revisitReason}</p>}

      <RecordingBlock
        proposed={item.proposed}
        recording={recording}
        onOpened={(how) => { notedStart.current = true; void journey.markListening(item, how, pid, 'app').then(bump, (e: unknown) => say(messageOf(e), 'danger')) }}
        onFindAlternative={comparison?.standIn || comparing ? undefined : () => void compare(true)}
        standInBelow={Boolean(standIn)}
        durationAbove={Boolean(duration) && Boolean(isConfirmed(recording))}
      />
      {comparing && missing && !comparison && <Waiting inline>Finding a recording of this work that Spotify has…</Waiting>}
      {standInShown && standIn && <StandInView c={standIn} b={b}>{listenAlong}</StandInView>}
      {!standInShown && listenAlong}
      {/* Read once: open the first time, then one line that still says who and why. */}
      {item.whyThisRecording && (
        <Twisty label="Why this recording" value={item.whyThisRecording} preview readOnce={`why-recording:${pid}:${item.id}`}>
          <p>{item.whyThisRecording}</p>
        </Twisty>
      )}

      {item.listenFor.length > 0 && (
        <>
          <p className={`${s.label} ${s.flush} ${s.mtMd}`}>Listen for</p>
          <ul className={s.listenFor}>{item.listenFor.map((l, i) => <li key={i}><Gloss text={l} /></li>)}</ul>
        </>
      )}

      {/* The work closes on one quiet line, as a printed programme would end on
          the music: where you stand with it, folded to a word, and the ways on as
          plain links. The choices open in place; while a hearing waits for a word
          on how it landed, the fold stays open, as the box it replaced did. */}
      <div className={s.workClose}>
        <ListeningRow work={item.proposed.work} state={state} open={feedbackPending} onPick={(to) => { void mark(to) }}>
          <div className={s.switchRow}>
            <div>
              <label htmlFor={`knew-${item.id}`} className={s.settingLabel}>I knew this one already</label>
              {knewIt && <p className={s.settingHint}>The curator won’t count it as a discovery.</p>}
            </div>
            <input id={`knew-${item.id}`} type="checkbox" role="switch" className={s.switch} checked={knewIt} onChange={() => void toggleKnown()} />
          </div>
          {(state === 'heard' || state === 'listening' || b.feedback.some((f) => (f.reaction || f.note) && (f.target.id === playedId || f.target.id === item.workId))) && (
            <div className={s.workFeedback}>
              <FeedbackPanel
                key={`${item.id}-${state}`}
                programmeId={pid}
                feedback={b.feedback}
                startOpen={feedbackPending}
                targets={[
                  { type: 'recording', id: playedId, label: playedId === item.recordingId ? 'This recording' : 'The recording you heard' },
                  { type: 'work', id: item.workId, label: 'The work itself' },
                ]}
              />
            </div>
          )}
        </ListeningRow>

        {/* Asked for, read once (open the time it arrives), then folded to its heading — a row like the one above. */}
        <MoreContextRow explanation={explanation} readKey={`context:${pid}:${item.id}`} writing={explaining} canAsk={curatorReady} onAsk={() => void explain()} />
        {!comparison && b.pairs && curatorReady && (
        <nav className={s.goFurther} aria-label={`Go further with ${item.proposed.work}`}>
          <button className={`${s.textButton} ${s.quietButton}`} onClick={() => void compare()} disabled={comparing}>
            {comparing ? 'Choosing a second recording…' : 'Another perspective'}
          </button>
        </nav>
        )}
      </div>

      {comparison && !standIn && <ComparisonView c={comparison} b={b} />}
    </div>
  )
}

/**
 * Where a sitting stands: in the week of its programme, on its own terms or
 * beside the theme — and the one tap that moves it (Journey.placeEvening). An
 * evening of its own can also be followed: three directions from it, and only
 * then a thread.
 */
function EveningPlace({ p, root, own }: { p: Programme; root: Programme; own: boolean }) {
  const { journey, bump, say, curatorReady } = useServices()
  const { following, follow } = useFollow()
  const [moving, setMoving] = useState(false)
  async function place(withTheme: boolean) {
    setMoving(true)
    try {
      await journey.placeEvening(p.id, withTheme)
      bump()
      say(withTheme ? `Now with “${root.title}”, in its thread.` : 'Now an evening of its own, in the week’s timeline.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setMoving(false)
    }
  }
  const seed = eveningSeed(p)
  return (
    <p className={s.quiet}>
      {own ? 'In the week of ' : 'Beside '}<a href={href({ name: 'programme', id: root.id })}>{root.title}</a>{own ? ', on its own terms.' : ', in its thread.'}{' '}
      <button className={`${s.textButton} ${s.quietButton}`} onClick={() => void place(own)} disabled={moving}>
        {own ? 'Belongs with this week’s theme' : 'Make it an evening of its own'}
      </button>
      {own && curatorReady && (
        <>{' · '}<button className={`${s.textButton} ${s.quietButton}`} onClick={() => void follow(seed)} disabled={following !== null}>{following === seed ? 'The curator is finding three…' : 'Follow this evening'}</button></>
      )}
    </p>
  )
}

/**
 * What was made beside this programme: a sitting for tonight, or more of its
 * theme. They are programmes of their own, joined to this one's thread, and used
 * to be found only in a fold at the very foot of the page ("More of this theme ·
 * 1 so far") — so an evening asked for in the morning was gone by the evening.
 * Said at the top instead, in the order they were made, each with what it is and when.
 */
function AlsoThisWeek({ extensions, members, current, isCurrent, timeZone }: { extensions: Programme[]; members: Set<string>; current: string; isCurrent: boolean; timeZone: string }) {
  const others = extensions.filter((x) => x.id !== current).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (!others.length) return null
  return (
    <nav className={s.alsoThisWeek} aria-label={isCurrent ? 'Also this week' : 'Also from this programme'}>
      <p className={`${s.eyebrow} ${s.flush}`}>{isCurrent ? 'Also this week' : 'Also from this programme'}</p>
      <ul>
        {others.map((x) => (
          <li key={x.id}>
            {isOwnEvening(x, members) && <><EveningMark />{' '}</>}
            <a href={href({ name: 'programme', id: x.id })}>{x.title}</a>
            <span className={s.faint}>
              {' · '}
              {x.sitting
                ? `${eveningWords(madeWords(x.createdAt, timeZone), isOwnEvening(x, members))}, ${x.sitting.hours === 1 ? 'about an hour' : 'about two hours'}${x.sitting.request ? ` — “${x.sitting.request}”` : ''}`
                : `${madeWords(x.createdAt, timeZone)} · more of this theme`}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The recording that takes the place of one Spotify doesn't have. The
 * curator's original choice stays above it, as written; this is the one to
 * press play on, chosen from Spotify's own list of recordings of the work.
 */
function StandInView({ c, b, children }: { c: Comparison; b: Bundle; children?: ReactNode }) {
  const { journey, bump, say } = useServices()
  const pv = c.perspectives[1]
  if (!pv) return <>{children}</>
  return (
    <div className={s.block}>
      <RecordingBlock
        label="On Spotify instead"
        proposed={pv.proposed}
        recording={b.recordings.get(pv.recordingId)}
        character={pv.character}
        onOpened={(how) => { void journey.markListening({ recordingId: pv.recordingId, workId: c.workId }, how, b.programme.id, 'app').then(bump, (e: unknown) => say(messageOf(e), 'danger')) }}
      />
      {children}
      {c.framing && <p className={`${s.quiet} ${s.flush}`}>{c.framing}</p>}
      {pv.listenFor && <p className={`${s.flush} ${s.mtXs}`}><span className={s.label}>Listen for</span><br />{pv.listenFor}</p>}
    </div>
  )
}

/**
 * The programme's own tools, quiet under the title: playlist, print, and the
 * length when there is no running order to say it.
 * Saving the playlist is a one-time choice; after that it keeps itself
 * current — rewritten whenever the confirmed recordings change.
 */
function ProgrammeTools({ b, showLength }: { b: Bundle; showLength: boolean }) {
  const { spotify, repo, bump, say, week, settings } = useServices()
  const [saving, setSaving] = useState(false)
  const items = b.programme.sections.flatMap((x) => x.items)
  // Each work as it plays: the curator's recording, or the stand-in where Spotify lacks it.
  const playable = items.map((i) => playableOf(b, i)).filter((r): r is NonNullable<ReturnType<typeof playableOf>> => Boolean(r))
  const total = playable.reduce((n, r) => n + (r.spotify?.durationMs ?? 0), 0)

  // Each time the programme's data changes (a confirmation, a swap, a stand-in),
  // bring a saved playlist into line. Quiet on success; a failure waits for the next change.
  const syncing = useRef(false)
  // A change that arrives mid-sync (the last confirmations often do) is kept, and synced once the current run ends.
  const again = useRef(false)
  const pid = b.programme.id
  const hasPlaylist = Boolean(b.playlist)
  useEffect(() => {
    if (!hasPlaylist || !spotify.connected) return
    if (syncing.current) { again.current = true; return }
    const run = (): void => {
      syncing.current = true
      again.current = false
      keepPlaylistCurrent(repo, spotify, pid, week.label, { hideSkipped: settings.hideSkipped })
        .then((wrote) => { if (wrote) bump() })
        .catch(() => {})
        .finally(() => { syncing.current = false; if (again.current) run() })
    }
    run()
  }, [b, hasPlaylist, pid, repo, spotify, week.label, bump, settings.hideSkipped])

  async function savePlaylist() {
    setSaving(true)
    try {
      const mark = await saveProgrammePlaylist(repo, spotify, b.programme.id, week.label, { hideSkipped: settings.hideSkipped })
      bump()
      say('Saved to your Spotify as a private playlist. It keeps itself up to date from here.', 'success')
      window.open(mark.url, '_blank', 'noopener')
    } catch (e) {
      say(e instanceof Error && !('reason' in e) ? e.message : messageOf(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${s.actions} ${s.mtMd}`}>
      {showLength && total > 0 && <span className={s.faint}>{playable.length === items.length ? 'The music runs' : 'What’s confirmed so far runs'} {aboutDuration(total)}</span>}
      {b.playlist && webUrl(b.playlist.url) && (
        <a href={webUrl(b.playlist.url)} target="_blank" rel="noopener noreferrer" title="Kept in step with the programme as recordings are confirmed">Open the playlist</a>
      )}
      {!b.playlist && spotify.connected && playable.length > 0 && (
        <button className={`${s.outlineButton} ${s.smallButton}`} onClick={savePlaylist} disabled={saving}>
          {saving ? 'Saving…' : 'Save as a Spotify playlist'}
        </button>
      )}
      <button className={`${s.textButton} ${s.printButton}`} onClick={() => window.print()}>Print</button>
    </div>
  )
}

/**
 * Live in Bucharest: a concert at the Ateneu or Sala Radio with a work, a
 * performer or a composer from this programme — one quiet line a concert, the
 * closest match first; the rest behind it. Then the cards for concerts marked
 * as going, leaving out those a line here already leads to.
 */
function LiveLine({ b, skip }: { b: Bundle; skip?: Set<string> }) {
  const { repo, settings } = useServices()
  const [concerts, setConcerts] = useState<LiveConcert[]>([])
  useEffect(() => {
    let live = true
    liveEvents(repo.marks)
      .then((events) => { if (live) setConcerts(liveMatches(b.programme, events, isoDateIn(new Date(), settings.timeZone))) })
      .catch(() => {})
    return () => { live = false }
  }, [repo, b.programme, settings.timeZone])
  // Marked as going: a preparation in the week before it, the entry pre-filled after (components/Going).
  const goings = useGoings()
  const today = isoDateIn(new Date(), settings.timeZone)
  // A skipped work steps out of its concert's line, and a concert left with nothing of the programme steps out too.
  // One marked as going comes first, so its way to the preparation isn't folded away.
  const kept = concerts
    .map((c) => ({ ...c, matches: c.matches.filter((m) => !skip?.has(m.item.id)) }))
    .filter((c) => c.matches.length)
    .sort((x, y) => Number(goings.some((g) => g.key === y.key)) - Number(goings.some((g) => g.key === x.key)))
  const cards = <GoingCards skip={new Set(kept.map((c) => c.key))} />
  if (!kept.length) return cards
  const line = (c: LiveConcert) => (
    <>
      {/* Said as every upcoming concert is said (the Concerts page, the cards): "at the Ateneu on Thursday". */}
      {whatIsOnAt(c)} at {venueShort(c.event.venue)} {whenWords(c.event.date, today, c.event.time)}
      {c.event.link && webUrl(c.event.link) && <> · <a href={webUrl(c.event.link)} target="_blank" rel="noopener noreferrer">{c.event.title}</a></>}
      {' '}<GoingToggle event={c.event} goings={goings} />
    </>
  )
  const [first, ...rest] = kept
  return (
    <>
      <div className={s.liveLine}>
        <p className={s.liveLead}><span className={s.label}>Live in Bucharest</span> {line(first)}</p>
        {rest.length > 0 && (
          <Twisty label="Also live" value={`${rest.length} more ${rest.length === 1 ? 'concert' : 'concerts'}`}>
            <ul className={s.bullets}>{rest.map((c) => <li key={c.key}>{line(c)}</li>)}</ul>
          </Twisty>
        )}
      </div>
      {cards}
    </>
  )
}

function ComparisonView({ c, b }: { c: Comparison; b: Bundle }) {
  const { journey, bump, say } = useServices()
  return (
    <div className={s.comparison}>
      <p className={`${s.quiet} ${s.flush}`}>{c.framing}</p>
      <div className={s.perspectives}>
        {c.perspectives.map((pv) => (
          <div key={pv.recordingId} className={s.perspective}>
            <RecordingBlock
              label="Perspective"
              proposed={pv.proposed}
              recording={b.recordings.get(pv.recordingId)}
              character={pv.character}
              onOpened={(how) => { void journey.markListening({ recordingId: pv.recordingId, workId: c.workId }, how, b.programme.id, 'app').then(bump, (e: unknown) => say(messageOf(e), 'danger')) }}
            />
            {pv.listenFor && <p className={s.flush}><span className={s.label}>Listen for</span><br />{pv.listenFor}</p>}
            <FeedbackPanel
              prompt="Which way did it speak to you?"
              programmeId={b.programme.id}
              feedback={b.feedback}
              targets={[{ type: 'interpretation', id: pv.recordingId, label: 'This interpretation' }]}
            />
          </div>
        ))}
      </div>
      {c.whyBoth && <p className={s.whyBoth}>{c.whyBoth}</p>}
    </div>
  )
}

const KIND_TITLE = { listen: 'Listen', read: 'Read', watch: 'Watch' } as const

function ResourcesView({ b, searching, onSearch }: { b: Bundle; searching: boolean; onSearch: () => void }) {
  const { curatorReady } = useServices()
  const groups = (['listen', 'read', 'watch'] as const).map((k) => ({ k, list: b.resources.filter((r) => r.kind === k) })).filter((g) => g.list.length)
  return (
    <section aria-label="Further listening and reading">
      <h2 className={s.sectionHead}>Further listening and reading</h2>
      <p className={s.sectionGuide}>{FURTHER_GUIDE}</p>
      {groups.length === 0 && searching && <Waiting>Looking for good reading and listening…</Waiting>}
      {groups.length === 0 && !searching && (
        <>
          <p className={s.quiet}>{b.resourcesSearched ? 'Nothing trustworthy turned up this time.' : 'Programme notes, essays and talks to go with this week.'}</p>
          <div className={s.actions}>
            <button className={`${s.outlineButton} ${s.smallButton}`} onClick={onSearch} disabled={!curatorReady}>{b.resourcesSearched ? 'Look again' : 'Find some'}</button>
          </div>
          {!curatorReady && <NeedsKey />}
        </>
      )}
      {/* The links are optional and outside the app: open the time they're found, folded after. */}
      {groups.length > 0 && (
        <Twisty
          label="The links"
          value={groups.map(({ k, list }) => `${list.length} to ${k}`).join(' · ')}
          readOnce={`further:${b.programme.id}:${b.resources.length}`}
        >
          {groups.map(({ k, list }) => (
            <div key={k} className={s.resourceGroup}>
              <h3 className={s.h3}>{KIND_TITLE[k]}</h3>
              <ul className={s.resources}>
                {list.map((r) => (
                  <li key={r.id} className={s.resource}>
                    {webUrl(r.url) ? <a href={webUrl(r.url)} target="_blank" rel="noopener noreferrer">{r.title}</a> : r.title}
                    <p>{r.source}{r.purpose ? ` — ${r.purpose}` : ''}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Twisty>
      )}
    </section>
  )
}

/**
 * The end of the week's programme: where to go next. Several honest answers,
 * none required — more on this theme, another direction this week, a path
 * left open earlier, a word to the curator, a wish for next week. One clearly
 * labelled section, so the last page of the week always has a way on.
 */
function WhereNext({ b, isCurrent }: { b: Bundle; isCurrent: boolean }) {
  const { journey, bump, say, curatorReady, week } = useServices()
  const p = b.programme
  const rootId = p.extends ?? p.id
  const [wish, setWish] = useState('')
  const [directionWish, setDirectionWish] = useState('')
  // One request at a time from here, whichever it is: each of these asks the
  // curator for this week's music, and two at once would race to rewrite the
  // week (another direction taken while three new ones are being found).
  // 'more', 'directions', 'sitting', or the id of the direction (or open path) being taken.
  const [busy, setBusy] = useState<string | null>(null)
  const extending = busy === 'more'
  const asking = busy === 'directions'
  // Every request here asks the curator: without a key, none can be made (said once, under the heading).
  const held = busy !== null || !curatorReady

  async function more() {
    setBusy('more')
    try {
      const x = await journey.extendProgramme(rootId, wish)
      bump()
      go({ name: 'programme', id: x.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  async function newDirections() {
    setBusy('directions')
    try {
      await journey.moreDirections(directionWish)
      setDirectionWish('')
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  async function take(o: ProgrammeOption) {
    setBusy(o.id)
    try {
      const x = await journey.changeDirection(o.id)
      bump()
      go({ name: 'programme', id: x.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const feedbackBody = (
    <>
      <p className={s.quiet}>A sentence is worth more than a button: what stayed with you, what didn’t. The next directions are shaped by it.</p>
      <FeedbackPanel
        prompt="How did this week land?"
        programmeId={p.id}
        feedback={b.feedback}
        targets={[{ type: 'programme', id: p.id, label: 'This programme' }, ...(b.theme ? [{ type: 'theme' as const, id: b.theme.id, label: 'The theme itself' }] : [])]}
      />
    </>
  )

  if (!isCurrent) {
    return (
      <section aria-label="This week" className={s.whereNext}>
        <h2 className={s.sectionHead}>Looking back</h2>
        <p className={s.sectionGuide}>This programme’s week is over or set aside; it stays here as it was. A word on how it landed still reaches the curator.</p>
        <div className={s.nextCard}>
          <h3 className={s.nextTitle}>How it landed</h3>
          {feedbackBody}
        </div>
      </section>
    )
  }

  // The programme ends where the music does: every way on is one folded line
  // saying what it offers, opened only when wanted. None of them is required.
  return (
    <section id={WHERE_NEXT} aria-label="Where next" className={`${s.whereNext} ${s.whereNextAnchor}`}>
      <h2 className={s.sectionHead}>Where next</h2>
      <p className={s.sectionGuide}>The end of this week’s programme. If you’ve run out of music, or want to go somewhere else, here are the ways on. None of them is required.</p>
      {!curatorReady && <NeedsKey to="ask the curator for any of these" />}

      <div className={s.twistyRun}>
        <Twisty label="More of this theme" value={b.extensions.length ? `${b.extensions.length} so far` : 'another set, on the same theme'} open={extending}>
          <p className={s.quiet}>Another set of works on the same theme, none of them heard yet this week: other composers, other periods, the connections this one pointed to.</p>
          {b.extensions.length > 0 && (
            <ul className={s.bullets}>
              {b.extensions.map((x) => (
                <li key={x.id}>{x.id === p.id ? <strong>{x.title}</strong> : <a href={href({ name: 'programme', id: x.id })}>{x.title}</a>}</li>
              ))}
            </ul>
          )}
          {/* A form, so Enter asks: one line, one request. */}
          <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); if (!held) void more() }}>
            <label className={s.visuallyHidden} htmlFor="more-wish">Anything in particular?</label>
            <input id="more-wish" className={s.input} maxLength={MAX_ASK} placeholder="Anything in particular? (optional)" value={wish} onChange={(e) => setWish(e.target.value)} disabled={busy !== null} />
            <CharCount value={wish} />
            <button type="submit" className={s.outlineButton} disabled={held}>{extending ? 'The curator is building it…' : b.extensions.length ? 'Ask for more again' : 'Ask for more'}</button>
          </form>
        </Twisty>

        <SittingCard folded joinsThread busy={busy !== null && busy !== 'sitting'} onMaking={(on) => setBusy(on ? 'sitting' : null)} keyHint={false} />

        <Twisty
          label="A different direction"
          value={b.otherOptions.length ? `${b.otherOptions.length} ${b.otherOptions.length === 1 ? 'other' : 'others'} this week, or three new` : 'three new, for the rest of the week'}
          open={asking || b.otherOptions.some((o) => o.id === busy)}
        >
          <p className={s.quiet}>Take another direction for the rest of the week. This programme stays in your journal as it is; only what you’ve heard of it counts towards its thread.</p>
          {b.otherOptions.length > 0 && (
            <ul className={s.entries}>
              {b.otherOptions.map((o) => (
                <li key={o.id} className={s.entry}>
                  <h4 className={s.nextOption}>{o.title}</h4>
                  <p className={s.quiet}>{o.pitch}</p>
                  <div className={s.actions}>
                    <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void take(o)} disabled={held}>
                      {busy === o.id ? 'The curator is building it…' : 'Take this direction instead'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); if (!held) void newDirections() }}>
            <label className={s.visuallyHidden} htmlFor="direction-wish">What are you in the mood for?</label>
            <input id="direction-wish" className={s.input} maxLength={MAX_ASK} placeholder="What are you in the mood for? (optional)" value={directionWish} onChange={(e) => setDirectionWish(e.target.value)} disabled={busy !== null} />
            <CharCount value={directionWish} />
            <button type="submit" className={s.outlineButton} disabled={held}>{asking ? 'The curator is finding three…' : 'Ask for three new directions'}</button>
          </form>
        </Twisty>

        {b.openPaths.length > 0 && (
          <Twisty label="Left open" value="from earlier weeks, not taken" open={b.openPaths.some((o) => o.id === busy)}>
            <p className={s.quiet}>Directions from earlier weeks, offered and not taken. Any of them can be this week’s instead.</p>
            <OpenPaths paths={b.openPaths} nowKey={week.key} busy={busy !== null && !b.openPaths.some((o) => o.id === busy)} onTaking={setBusy} keyHint={false} />
          </Twisty>
        )}

        <Twisty label="How it landed" value="a sentence to the curator">{feedbackBody}</Twisty>

        <Twisty label="A wish for next week" value="a composer, a mood, a question">
          <p className={s.quiet}>Plant an idea for the next three directions — a composer, a mood, a question.</p>
          <a href={href({ name: 'notebook' })}>Write a wish in the Notebook</a>
        </Twisty>
      </div>
    </section>
  )
}
