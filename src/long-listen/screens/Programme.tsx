import { useEffect, useRef, useState } from 'react'
import type {
  Comparison, Explanation, Feedback, ListeningEvent, ListeningKind, ListeningState, Programme, ProgrammeItem, ProgrammeOption, Recording, Resource, Theme, ThemeExploration, WeekRecord, Work,
} from '../domain/types'
import { latestFeedback, listeningState } from '../domain/listening'
import { sinceWords, weekFromKey } from '../domain/week'
import type { Repo } from '../store/repo'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { aboutDuration, needsLook, saveProgrammePlaylist, spotifyCandidates, verifyRecording, type PlaylistMark } from '../spotify/verify'
import { RecordingBlock } from '../components/RecordingBlock'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

interface Bundle {
  programme: Programme
  theme?: Theme
  exploration?: ThemeExploration
  firstExploration?: ThemeExploration
  week?: WeekRecord
  otherOptions: ProgrammeOption[]
  comparisons: Comparison[]
  recordings: Map<string, Recording>
  works: Map<string, Work>
  events: ListeningEvent[]
  feedback: Feedback[]
  resources: Resource[]
  resourcesSearched: boolean
  explanations: Map<string, Explanation>
  playlist?: PlaylistMark
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
  const explanations = new Map((await repo.explanations.many(items.map((i) => `${id}:${i.id}`))).map((e) => [e.id.split(':').pop()!, e]))
  const explorations = theme ? await repo.explorations.many(theme.explorationIds) : []
  const otherOptions = week
    ? (await repo.options.many(week.optionIds)).filter((o) => o.id !== week.chosenOptionId && o.status !== 'chosen')
    : []
  return {
    programme, theme, exploration, week, otherOptions, comparisons, recordings, works, events, feedback,
    firstExploration: explorations.sort((a, b) => a.weekKey.localeCompare(b.weekKey))[0],
    resources: allResources.filter((r) => r.programmeId === id),
    resourcesSearched: Boolean(searched),
    explanations,
    playlist: playlistMark?.value as PlaylistMark | undefined,
  }
}

const STATES: { value: ListeningState; label: string; kind: ListeningKind }[] = [
  { value: 'not-started', label: 'Not started', kind: 'reset' },
  { value: 'listening', label: 'Listening', kind: 'listening' },
  { value: 'heard', label: 'Heard', kind: 'heard' },
  { value: 'skipped', label: 'Skipped', kind: 'skipped' },
]

export function ProgrammeScreen({ id }: { id: string }) {
  const { repo } = useServices()
  const { data, error, loading } = useLoad(() => loadBundle(repo, id), [id])
  if (error) return <Problem error={error} />
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
  const { journey, spotify, repo, bump, say, week } = useServices()
  const { programme: p } = b
  const isCurrent = p.weekKey === week.key && b.week?.programmeId === p.id
  const setAside = b.week?.setAsideProgrammeIds.includes(p.id)
  // Confirm each recording on Spotify once, quietly, in order.
  const tried = useRef(new Set<string>())
  useEffect(() => {
    if (!spotify.connected) return
    let stop = false
    ;(async () => {
      const pending = [
        ...b.programme.sections.flatMap((x) => x.items).map((i) => ({ rid: i.recordingId, proposed: i.proposed })),
        ...b.comparisons.flatMap((c) => c.perspectives.map((x) => ({ rid: x.recordingId, proposed: x.proposed }))),
      ].filter(({ rid }) => needsLook(b.recordings.get(rid)) && !tried.current.has(rid))
      for (const { rid, proposed } of pending) {
        if (stop) return
        tried.current.add(rid)
        try {
          await verifyRecording(repo, spotify, rid, proposed)
          bump()
        } catch {
          return // signed out, offline or throttled: the buttons stay, nothing is lost
        }
      }
    })()
    return () => { stop = true }
  }, [b, spotify, repo, bump])

  // This week's programme gathers its further reading once, by itself.
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    if (!isCurrent || b.resourcesSearched || searching) return
    setSearching(true)
    journey.resources(p.id).then(() => bump()).catch(() => {}).finally(() => setSearching(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent, b.resourcesSearched, p.id])

  const first = b.firstExploration
  const returning = p.stage > 1 && first

  return (
    <article>
      <p className={s.eyebrow}>
        {isCurrent ? 'This week’s programme' : setAside ? 'Set aside' : 'From the journal'} · {weekFromKey(p.weekKey).label}
      </p>
      <h1 className={s.title}>{p.title}</h1>
      {p.dek && <p className={s.dek}>{p.dek}</p>}

      {returning && (
        <div className={s.continuity}>
          <p className={s.eyebrow}>A returning thread · {stageWords(p.stage)} visit · first explored {sinceWords(first.weekKey, p.weekKey)}</p>
          {p.continuityNote && <p style={{ margin: 0 }}>{p.continuityNote}</p>}
        </div>
      )}

      <ProgrammeTools b={b} />

      <hr className={s.rule} />
      <Paragraphs text={p.introduction} className={s.lede} />

      <div className={s.asides}>
        {p.whyNow && <div className={s.aside}><h2 className={s.h3}>Why this, now</h2><p>{p.whyNow}</p></div>}
        {p.historicalPlace && <div className={s.aside}><h2 className={s.h3}>Where it sits</h2><p>{p.historicalPlace}</p></div>}
        {p.howTheyRelate && <div className={s.aside}><h2 className={s.h3}>How they speak to each other</h2><p>{p.howTheyRelate}</p></div>}
      </div>

      {p.sections.map((section, i) => (
        <section key={section.id} aria-label={section.heading}>
          <h2 className={s.sectionHead}>{section.heading}</h2>
          <p className={s.sectionGuide}>
            Part {i + 1} of {p.sections.length}{ROLE_GUIDE[section.role] ? ` — ${ROLE_GUIDE[section.role]}` : ''}
          </p>
          {section.note && <p className={s.sectionNote}>{section.note}</p>}
          {section.items.map((item) => (
            <ItemView
              key={item.id}
              item={item}
              b={b}
              comparison={b.comparisons.find((c) => c.id === `cmp:${p.id}:${item.id}`)}
            />
          ))}
        </section>
      ))}

      {b.comparisons.filter((c) => c.origin === 'programme').map((c) => (
        <section key={c.id} aria-label="Two perspectives">
          <h2 className={s.sectionHead}>Same work, two perspectives</h2>
          <p className={s.sectionGuide}>{PAIR_GUIDE}</p>
          <ComparisonView c={c} b={b} />
        </section>
      ))}

      <ResourcesView b={b} searching={searching} onSearch={async () => {
        setSearching(true)
        try { await journey.resources(p.id); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setSearching(false) }
      }} />

      <hr className={s.ornament} />
      <section aria-label="The week">
        <FeedbackPanel
          prompt="How did this week land?"
          programmeId={p.id}
          feedback={b.feedback}
          targets={[{ type: 'programme', id: p.id, label: 'This programme' }, ...(b.theme ? [{ type: 'theme' as const, id: b.theme.id, label: 'The theme itself' }] : [])]}
        />
      </section>

      {isCurrent && b.otherOptions.length > 0 && <ChangeDirection options={b.otherOptions} />}
    </article>
  )
}

function ItemView({ item, b, comparison }: { item: ProgrammeItem; b: Bundle; comparison?: Comparison }) {
  const { journey, bump, say, spotify, curatorReady } = useServices()
  const pid = b.programme.id
  const state = listeningState(b.events, item.recordingId)
  const recording = b.recordings.get(item.recordingId)
  const [explaining, setExplaining] = useState(false)
  const [comparing, setComparing] = useState(false)
  const explanation = b.explanations.get(item.id)
  const work = b.works.get(item.workId)
  const metaBits = [work?.catalogue ?? item.proposed.catalogue, work?.composed, work?.form].filter(Boolean)

  async function mark(kind: ListeningKind) {
    await journey.markListening(item, kind, pid)
    bump()
  }

  const knewIt = Boolean(latestFeedback(b.feedback, item.workId).known)
  async function toggleKnown() {
    await journey.markKnown(item.workId, !knewIt, pid)
    bump()
  }

  async function explain() {
    setExplaining(true)
    try { await journey.explain(pid, item.id); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setExplaining(false) }
  }

  async function compare(mustBeOnSpotify = false, quiet = false) {
    setComparing(true)
    try {
      // A stand-in is chosen from what Spotify really has, never from memory alone.
      const candidates = mustBeOnSpotify && spotify.connected ? await spotifyCandidates(spotify, item.proposed) : undefined
      if (mustBeOnSpotify && candidates && candidates.length === 0) {
        if (!quiet) say('Spotify has no recording of this work that the app could find.')
        return
      }
      await journey.compare(pid, item.id, { mustBeOnSpotify, spotifyCandidates: candidates })
      bump()
    } catch (e) {
      if (!quiet) say(messageOf(e), 'danger')
    } finally {
      setComparing(false)
    }
  }

  // When Spotify truly lacks the curator's recording, find one it has, once, by itself.
  const missing = recording?.verification === 'not-found' && !needsLook(recording)
  const askedForStandIn = useRef(false)
  useEffect(() => {
    if (!missing || comparison || !spotify.connected || !curatorReady || askedForStandIn.current) return
    askedForStandIn.current = true
    void compare(true, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, comparison, spotify.connected, curatorReady])
  const standIn = comparison?.standIn ? comparison : undefined

  return (
    <div className={s.item}>
      <p className={s.composer}>{item.proposed.composer}</p>
      <h3 className={s.work}>{item.proposed.work}</h3>
      {metaBits.length > 0 && <p className={s.workMeta}>{metaBits.join(' · ')}</p>}

      <div className={s.prose} style={{ marginTop: 'var(--space-sm)' }}><p>{item.why}</p></div>
      {item.revisitReason && <p className={s.continuity} style={{ margin: 'var(--space-sm) 0' }}>{item.revisitReason}</p>}

      <RecordingBlock
        proposed={item.proposed}
        recording={recording}
        onOpened={(how) => { void journey.markListening(item, how, pid, 'app').then(bump) }}
        onFindAlternative={comparison || comparing ? undefined : () => void compare(true)}
        standInBelow={Boolean(standIn)}
      />
      {comparing && missing && !comparison && <p className={s.note}>Finding a recording of this work that Spotify has…</p>}
      {standIn && <StandInView c={standIn} b={b} />}
      {item.whyThisRecording && <p style={{ margin: 0 }}><span className={s.label}>Why this recording</span><br />{item.whyThisRecording}</p>}

      {item.listenFor.length > 0 && (
        <>
          <p className={s.label} style={{ margin: 'var(--space-md) 0 0' }}>Listen for</p>
          <ul className={s.listenFor}>{item.listenFor.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}

      <div className={s.states} role="radiogroup" aria-label={`Where you are with ${item.proposed.work}`}>
        {STATES.map((st) => (
          <button key={st.value} role="radio" aria-checked={state === st.value} className={`${s.state} ${state === st.value ? s.stateOn : ''}`} onClick={() => mark(st.kind)}>
            {st.label}
          </button>
        ))}
      </div>

      <p className={s.knownLine}>
        {knewIt
          ? <>You knew this one before; the curator won’t treat it as a discovery. <button className={`${s.textButton} ${s.quietButton}`} onClick={toggleKnown}>Undo</button></>
          : <button className={`${s.textButton} ${s.quietButton}`} onClick={toggleKnown}>I knew this already</button>}
      </p>

      {(state === 'heard' || state === 'listening' || b.feedback.some((f) => (f.reaction || f.note) && (f.target.id === item.recordingId || f.target.id === item.workId))) && (
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <FeedbackPanel
            key={`${item.id}-${state}`}
            programmeId={pid}
            feedback={b.feedback}
            startOpen={state === 'heard' && !b.feedback.some((f) => f.target.id === item.recordingId)}
            targets={[
              { type: 'recording', id: item.recordingId, label: 'This recording' },
              { type: 'work', id: item.workId, label: 'The work itself' },
            ]}
          />
        </div>
      )}

      <div className={s.actions}>
        {!explanation && <button className={s.textButton} onClick={explain} disabled={explaining}>{explaining ? 'The curator is writing…' : 'A little more context'}</button>}
        {!comparison && <button className={s.textButton} onClick={() => void compare()} disabled={comparing}>{comparing ? 'Choosing a second recording…' : 'Hear another perspective'}</button>}
        <a href={href({ name: 'listen', programmeId: pid, itemId: item.id })}>Listen with this open</a>
      </div>

      {explanation && (
        <div className={s.block}>
          <h4 className={s.h3}>{explanation.heading}</h4>
          <Paragraphs text={explanation.body} className={s.prose} />
        </div>
      )}
      {comparison && !standIn && <ComparisonView c={comparison} b={b} />}
    </div>
  )
}

/**
 * The recording that takes the place of one Spotify doesn't have. The
 * curator's original choice stays above it, as written; this is the one to
 * press play on, chosen from Spotify's own list of recordings of the work.
 */
function StandInView({ c, b }: { c: Comparison; b: Bundle }) {
  const { journey, bump } = useServices()
  const pv = c.perspectives[1]
  if (!pv) return null
  return (
    <div className={s.block}>
      <RecordingBlock
        label="On Spotify instead"
        proposed={pv.proposed}
        recording={b.recordings.get(pv.recordingId)}
        character={pv.character}
        onOpened={(how) => { void journey.markListening({ recordingId: pv.recordingId, workId: c.workId }, how, b.programme.id, 'app').then(bump) }}
      />
      {c.framing && <p className={s.quiet} style={{ margin: 0 }}>{c.framing}</p>}
      {pv.listenFor && <p style={{ margin: 'var(--space-xs) 0 0' }}><span className={s.label}>Listen for</span><br />{pv.listenFor}</p>}
    </div>
  )
}

/** The programme's own tools, quiet under the title: playlist, length, print. */
function ProgrammeTools({ b }: { b: Bundle }) {
  const { spotify, repo, bump, say, week } = useServices()
  const [saving, setSaving] = useState(false)
  const items = b.programme.sections.flatMap((x) => x.items)
  const verified = items.filter((i) => b.recordings.get(i.recordingId)?.verification === 'verified')
  const total = verified.reduce((n, i) => n + (b.recordings.get(i.recordingId)?.spotify?.durationMs ?? 0), 0)

  async function savePlaylist() {
    setSaving(true)
    try {
      const mark = await saveProgrammePlaylist(repo, spotify, b.programme.id, week.label)
      bump()
      say(b.playlist ? 'Playlist brought up to date.' : 'Saved to your Spotify as a private playlist.', 'success')
      if (!b.playlist) window.open(mark.url, '_blank', 'noopener')
    } catch (e) {
      say(e instanceof Error && !('reason' in e) ? e.message : messageOf(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.actions} style={{ marginTop: 'var(--space-md)' }}>
      {total > 0 && <span className={s.faint}>{verified.length === items.length ? 'The music runs' : 'What’s confirmed so far runs'} {aboutDuration(total)}</span>}
      {b.playlist && webUrl(b.playlist.url) && <a href={webUrl(b.playlist.url)} target="_blank" rel="noopener noreferrer">Open the playlist</a>}
      {spotify.connected && verified.length > 0 && (
        <button className={s.textButton} onClick={savePlaylist} disabled={saving}>
          {saving ? 'Saving…' : b.playlist ? 'Update the playlist' : 'Save as a Spotify playlist'}
        </button>
      )}
      <button className={s.textButton} onClick={() => window.print()}>Print</button>
    </div>
  )
}

function ComparisonView({ c, b }: { c: Comparison; b: Bundle }) {
  const { journey, bump } = useServices()
  return (
    <div className={s.comparison}>
      <p className={s.quiet} style={{ margin: 0 }}>{c.framing}</p>
      <div className={s.perspectives}>
        {c.perspectives.map((pv) => (
          <div key={pv.recordingId} className={s.perspective}>
            <RecordingBlock
              label="Perspective"
              proposed={pv.proposed}
              recording={b.recordings.get(pv.recordingId)}
              character={pv.character}
              onOpened={(how) => { void journey.markListening({ recordingId: pv.recordingId, workId: c.workId }, how, b.programme.id, 'app').then(bump) }}
            />
            {pv.listenFor && <p style={{ margin: 0 }}><span className={s.label}>Listen for</span><br />{pv.listenFor}</p>}
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

/** Only http(s) links are rendered: a restored backup is data, and a javascript: URL in it must not become a link. */
function webUrl(u: string): string | undefined {
  try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : undefined } catch { return undefined }
}

const KIND_TITLE = { listen: 'Listen', read: 'Read', watch: 'Watch' } as const

function ResourcesView({ b, searching, onSearch }: { b: Bundle; searching: boolean; onSearch: () => void }) {
  const groups = (['listen', 'read', 'watch'] as const).map((k) => ({ k, list: b.resources.filter((r) => r.kind === k) })).filter((g) => g.list.length)
  return (
    <section aria-label="Further listening and reading">
      <h2 className={s.sectionHead}>Further listening and reading</h2>
      <p className={s.sectionGuide}>{FURTHER_GUIDE}</p>
      {groups.length === 0 && searching && <Waiting>Looking for good reading and listening…</Waiting>}
      {groups.length === 0 && !searching && (
        <p className={s.quiet}>
          {b.resourcesSearched ? 'Nothing trustworthy turned up this time.' : 'Programme notes, essays and talks to go with this week.'}{' '}
          <button className={s.textButton} onClick={onSearch}>{b.resourcesSearched ? 'Look again' : 'Find some'}</button>
        </p>
      )}
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
    </section>
  )
}

function ChangeDirection({ options }: { options: ProgrammeOption[] }) {
  const { journey, bump, say } = useServices()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function take(o: ProgrammeOption) {
    setBusy(o.id)
    try {
      const p = await journey.changeDirection(o.id)
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={s.block} aria-label="Change direction">
      {!open ? (
        <button className={s.textButton} onClick={() => setOpen(true)}>Change direction this week</button>
      ) : (
        <>
          <p className={s.quiet}>This programme stays in your journal as it is. Only what you’ve heard of it will count towards its thread.</p>
          <ul className={s.entries}>
            {options.map((o) => (
              <li key={o.id} className={s.entry}>
                <h3 className={s.entryTitle}>{o.title}</h3>
                <p className={s.quiet}>{o.pitch}</p>
                <button className={s.textButton} onClick={() => take(o)} disabled={busy !== null}>
                  {busy === o.id ? 'The curator is building it…' : 'Listen this way instead'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
