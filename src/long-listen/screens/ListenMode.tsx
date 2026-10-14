import { useEffect, useRef, useState } from 'react'
import type { ProgrammeItem } from '../domain/types'
import { creditLine } from '../domain/identity'
import { listeningState } from '../domain/listening'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useWakeLock } from '../../shared/useWakeLock'
import { applyDusk, chooseDusk, rememberDusk } from '../app/theme'
import { onPlayerReading, usePlayback, usePlayerState } from '../app/playback'
import { MiniPlayer, MovementProgress, MovementSteps, movementLength, useLiveProgress } from '../components/ListenParts'
import { listenForAt, movementTitles, primeMinutes } from '../domain/programmeStyle'
import { creditRows } from '../components/Credits'
import { workEnded } from '../spotify/workGuard'
import { readJson, writeJson } from '../../shared/storage'
import { onHeardRecorded } from '../app/HeardWitness'
import { ListenBar } from '../components/ListenBar'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { isConfirmed } from '../spotify/verify'
import { CharCount, MAX_ASK, NeedsKey, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import { spotifyQuery } from '../components/RecordingBlock'
import { searchUrl } from '../spotify/client'
import { heardAs, standInPlayersOf, standInsOf } from '../domain/standIns'
import { NotFound } from '../store/repo'
import { Twisty } from '../components/Twisty'
import s from '../styles/editorial.module.css'

/**
 * One recording, while it plays: the work, who plays it, and what to listen
 * for, in large type with the screen kept awake. With Spotify connected and
 * playing this recording, the movement that's sounding is marked — a place in
 * the music, not a progress bar.
 *
 * One work at a time, and it stops when the work does: nothing plays on by
 * itself. "I've heard it" asks how it landed in place, then offers the next
 * work, for when the listener is ready.
 */
const FOCUS_KEY = 'long-listen:listen-focus'
/** Set by "Play next" on the work before: the listening view it opens starts its work. */
const AUTOPLAY_KEY = 'long-listen:autoplay'

export function ListenModeScreen({ programmeId, itemId }: { programmeId: string; itemId: string }) {
  const { repo, spotify, journey, bump } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const programme = await repo.programmes.require(programmeId)
    const items = programme.sections.flatMap((x) => x.items)
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new NotFound(`item ${itemId} is not in programme ${programmeId}`)
    const comparisons = await repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))
    // Each item's stand-in, where Spotify lacked the curator's recording: read as the item (domain/standIns.ts).
    const standIns = standInsOf(comparisons)
    const players = standInPlayersOf(comparisons)
    const idsOf = (i: ProgrammeItem) => heardAs(i, programmeId, standIns)
    const ids = items.flatMap(idsOf)
    const [recordings, events, feedback, explanation, answers, work] = await Promise.all([
      repo.recordings.many(ids), repo.events.all(), repo.feedback.all(), repo.explanations.get(`${programmeId}:${itemId}`), journey.answers(programmeId, itemId), repo.works.get(item.workId),
    ])
    const byId = new Map(recordings.map((r) => [r.id, r]))
    // What plays: the programme's recording, or — when Spotify lacks it — the stand-in found in its place.
    const playable = (i: ProgrammeItem) => {
      if (isConfirmed(byId.get(i.recordingId))) return { recording: byId.get(i.recordingId), proposed: i.proposed, standIn: false }
      const other = players.get(`cmp:${programmeId}:${i.id}`)
      return other && isConfirmed(byId.get(other.recordingId)) ? { recording: byId.get(other.recordingId), proposed: other.proposed, standIn: true } : undefined
    }
    const here = playable(item)
    const notes = here?.recording ? (await repo.marks.get(`companion:${here.recording.id}`))?.value as { movements: string[] } | undefined : undefined
    // Already heard (by either recording, the stand-in included): the screen opens on how it landed, never on "I've heard it" again.
    const heardBefore = listeningState(events, idsOf(item)) === 'heard'
    return {
      programme, item, recording: here?.recording, credit: here?.proposed ?? item.proposed, standIn: here?.standIn ?? false, heardBefore,
      next: nextWork(items, item, (i) => Boolean(playable(i)), idsOf, events), feedback, notes: notes?.movements ?? [], explanation, answers, work,
    }
  }, [programmeId, itemId])
  useWakeLock(true)

  // Dusk while this screen is open: one of four dark shades, at random each visit (never last visit's).
  // Chosen once per visit, remembered once, applied while open — and only once there is a work to show:
  // a dead link is not a visit, and its message reads on the paper.
  const [shade] = useState(() => chooseDusk())
  const remembered = useRef(false)
  const loaded = Boolean(data)
  useEffect(() => {
    if (!loaded) return
    if (!remembered.current) { remembered.current = true; rememberDusk(shade) }
    return applyDusk(shade)
  }, [shade, loaded])
  const sp0 = isConfirmed(data?.recording) ? data.recording.spotify : undefined
  // Which movement is sounding, playing or paused — shared with the programme's buttons.
  const playback = usePlayback(sp0?.trackUris, sp0?.trackIds)

  const { curatorReady, say } = useServices()
  // The companion's notes are written once per programme; if this recording has none yet, ask for them now.
  const askedNotes = useRef(false)
  useEffect(() => {
    if (!data || !sp0 || data.notes.length || !curatorReady || askedNotes.current) return
    askedNotes.current = true
    journey.companion(programmeId).then((n) => { if (n) bump() }).catch(() => {})
  }, [data, sp0, curatorReady, journey, programmeId, bump])

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [explaining, setExplaining] = useState(false)

  const [heardOpen, setHeardOpen] = useState(false)
  // Watched play to its end (app/HeardWitness.tsx): already marked heard — open the same panel as "I've heard it".
  const playedId = data ? (data.recording?.id ?? data.item.recordingId) : undefined
  useEffect(() => (playedId ? onHeardRecorded((ids) => { if (ids.includes(playedId)) setHeardOpen(true) }) : undefined), [playedId])
  const [marking, setMarking] = useState(false)
  // A ref as well as the state: two taps in one frame both see the state as it was before either.
  const markingNow = useRef(false)

  // Where in the movement it is, to the second (Spotify's reading, carried by the clock).
  const player = usePlayerState()
  const live = useLiveProgress(player.np, sp0?.trackIds)

  // Focus: only the music — the movement sounding, its note, what to listen for, the controls. Per device.
  const [focus, setFocus] = useState(() => readJson<boolean>(FOCUS_KEY, false))
  const toggleFocus = () => { setFocus((f) => { writeJson(FOCUS_KEY, !f); return !f }) }

  // The compact player at the foot appears once the Play row has scrolled out of sight.
  const barRef = useRef<HTMLDivElement>(null)
  const [barOut, setBarOut] = useState(false)
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setBarOut(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [loaded])

  // A new movement begins: bring its line into view — unless the listener has touched the page in the last few seconds.
  const touchedAt = useRef(0)
  useEffect(() => {
    const touched = () => { touchedAt.current = Date.now() }
    const opts = { passive: true } as const
    window.addEventListener('wheel', touched, opts)
    window.addEventListener('touchmove', touched, opts)
    window.addEventListener('keydown', touched)
    return () => {
      window.removeEventListener('wheel', touched)
      window.removeEventListener('touchmove', touched)
      window.removeEventListener('keydown', touched)
    }
  }, [])
  const shownIndex = useRef<number | null>(null)
  const nowAt = playback.at?.index ?? null
  useEffect(() => {
    const before = shownIndex.current
    shownIndex.current = nowAt
    if (nowAt === null || before === null || before === nowAt || Date.now() - touchedAt.current < 8000) return
    document.querySelector(`[data-movement="${nowAt}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [nowAt])

  // The last movement has just ended: the work is heard — said at once, and "how did it land" opens,
  // rather than waiting a minute for Spotify's history. (One-track works: app/HeardWitness.tsx does this.)
  const ended = useRef(false)
  // The latest of what's loaded and shown, for a listener set up once per work.
  const latest = useRef({ data, heardOpen })
  latest.current = { data, heardOpen }
  const trackKey = sp0?.trackIds.join() ?? ''
  useEffect(() => {
    if (!data || !sp0 || sp0.trackIds.length < 2) return
    const ids = sp0.trackIds
    let prev: typeof player.np = null
    return onPlayerReading((np) => {
      const was = prev
      prev = np
      if (ended.current || !workEnded(was, np, ids)) return
      ended.current = true
      const { data: d, heardOpen: open } = latest.current
      if (!d || open) return
      const played = { recordingId: d.recording?.id ?? d.item.recordingId, workId: d.item.workId }
      const mark = d.heardBefore ? Promise.resolve() : journey.markListening(played, 'heard', d.programme.id, 'app').then(() => bump())
      mark.then(() => setHeardOpen(true), () => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, loaded])

  // Arrived from "Play next" on the work before: start this one, once.
  const autoplayed = useRef(false)
  useEffect(() => {
    if (!data || !sp0 || autoplayed.current || !spotify.connected) return
    autoplayed.current = true
    let wanted = false
    try { wanted = sessionStorage.getItem(AUTOPLAY_KEY) === itemId; sessionStorage.removeItem(AUTOPLAY_KEY) } catch { /* private mode */ }
    if (wanted) void playback.play(0).then((ok) => { if (ok) void journey.markListening({ recordingId: data.recording?.id ?? data.item.recordingId, workId: data.item.workId }, 'play-started', data.programme.id, 'app').then(bump, () => {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, sp0])

  // Each movement's length: kept with new matches; for a recording confirmed before that, read from its album once.
  const filling = useRef(false)
  useEffect(() => {
    const rec = data?.recording
    if (!rec || !sp0 || sp0.trackDurationsMs || !spotify.connected || filling.current) return
    filling.current = true
    spotify.albumTracks(sp0.albumId).then(async (tracks) => {
      const byTrack = new Map(tracks.map((x) => [x.id, x.duration_ms]))
      const durations = sp0.trackIds.map((id) => byTrack.get(id))
      if (durations.some((d) => !d)) return
      const fresh = await repo.recordings.get(rec.id)
      if (!fresh?.spotify || fresh.spotify.trackIds.join() !== sp0.trackIds.join()) return
      await repo.recordings.put({ ...fresh, spotify: { ...fresh.spotify, trackDurationsMs: durations as number[] } })
      bump()
    }).catch(() => {})
  }, [data, sp0, spotify, repo, bump])

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'There’s no such work to listen to — perhaps an old link.', link: { href: href({ name: 'week' }), label: 'This week' } }} />
  if (!data) return <Waiting>Opening the listening view…</Waiting>
  const { programme, item, recording, next, credit, standIn, notes } = data
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  // What is marked, and reacted to, is the recording that plays — a stand-in's own, where it stands in.
  const played = { recordingId: recording?.id ?? item.recordingId, workId: item.workId }
  // This recording's own movements, as its album divides them — named as a programme names them.
  const movements = sp?.trackNames ?? []
  const titled = movementTitles(sp?.trackNames)
  const work = data.work
  // One line of facts under the title, and the performers on one line: what it is, at a glance.
  const facts = [work?.form ? work.form.charAt(0).toUpperCase() + work.form.slice(1) : '', work?.composed ?? '', titled.length > 1 ? `${titled.length} movements` : '', primeMinutes(sp?.durationMs) ?? ''].filter(Boolean).join(' · ')
  const performers = creditRows(credit).map(([, name]) => name).join(' · ')
  // What to listen for, tied to the movement sounding where the curator said which (programmes from 14 October 2026).
  const forAt = listenForAt(item.listenForAt, item.listenFor.length, titled.length)

  async function ask() {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    try {
      const movement = nowIndex !== null ? movements[nowIndex] : undefined
      await journey.explain(programme.id, item.id, q, { recording: creditLine(credit), movement })
      setQuestion('')
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setAsking(false)
    }
  }

  async function explain() {
    setExplaining(true)
    try { await journey.explain(programme.id, item.id); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setExplaining(false) }
  }

  // Once per tap: a second tap while the first is being kept would record the work heard twice.
  async function heard() {
    if (markingNow.current) return
    markingNow.current = true
    setMarking(true)
    try {
      await journey.markListening(played, 'heard', programme.id)
      bump()
      setHeardOpen(true)
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      markingNow.current = false
      setMarking(false)
    }
  }

  // Something already said about this work or the recording that plays: the panel opens folded on a return visit.
  const saidSomething = Boolean(data && data.feedback.some((f) => (f.reaction || f.note) && (f.target.id === (data.recording?.id ?? data.item.recordingId) || f.target.id === data.item.workId)))

  const started = () => { void journey.markListening(played, 'play-started', programme.id, 'app').then(bump, (e: unknown) => say(messageOf(e), 'danger')) }
  const nowIndex = playback.at?.index ?? null

  // A movement can be started from the list: the place in the music, by its name.
  async function playFrom(i: number) {
    if (await playback.play(i)) started()
  }

  return (
    <article className={focus ? `${s.listenMode} ${s.listenFocus}` : s.listenMode}>
      <div className={s.listenTop}>
        <p className={`${s.eyebrow} ${s.mb0}`}><a href={href({ name: 'programme', id: programme.id })} className={`${s.quietLink} ${s.backLink}`}>← {programme.title}</a></p>
        {/* Focus: only the music, for the phone on the armrest. Remembered on this device. */}
        <button type="button" className={`${s.textButton} ${s.quietButton}`} aria-pressed={focus} onClick={toggleFocus}>{focus ? 'Show everything' : 'Focus'}</button>
      </div>
      <p className={s.composer}>{item.proposed.composer}</p>
      <h1 className={s.title}>{item.proposed.work}</h1>
      {/* What it is and who plays it, one line each: the facts at a glance, not a block to read. */}
      {facts && <p className={s.listenFacts}>{facts}</p>}
      {performers && <p className={s.listenPerformers}>{performers}</p>}
      {standIn && !focus && <p className={s.note}>On Spotify in place of the curator’s choice ({creditLine(item.proposed)}), which Spotify doesn’t carry.</p>}

      {/* The same listen bar as the programme; placed first, since pressing it is what this screen is for.
          While this work is on, previous and next sit either side of Pause — kept inside the work. */}
      <div ref={barRef}>
        {sp
          ? <ListenBar
              firstTrackId={sp.trackIds[0]} movements={sp.trackIds.length} durationMs={sp.durationMs} playback={playback} onStarted={started} className={s.mtMd}
              steps={playback.at && sp.trackIds.length > 1 ? (control) => <MovementSteps playback={playback} index={playback.at!.index} count={sp.trackIds.length}>{control}</MovementSteps> : undefined}
            />
          : (
            // Not confirmed on Spotify (or Spotify not connected): the same search as the programme offers, so it can still be heard.
            <div className={`${s.actions} ${s.mtMd}`}>
              <a className={s.outlineButton} href={searchUrl(spotifyQuery(credit))} target="_blank" rel="noopener noreferrer">Look for it on Spotify</a>
            </div>
          )}
      </div>

      {titled.length > 1 && (
        <ol className={s.movements}>
          {titled.map((m, i) => {
            const now = nowIndex === i
            // In focus, only the movement sounding (or every movement, before anything plays).
            if (focus && nowIndex !== null && !now) return null
            return (
              <li key={`${i}-${m.title}`} data-movement={i} className={now ? s.movementNow : undefined} aria-current={now ? 'true' : undefined}>
                <span className={s.movementLine}>
                  <span className={s.movementNumeral}>{m.numeral}.</span>
                  <span className={s.movementName}>
                    {spotify.connected
                      ? <button type="button" className={s.movementButton} onClick={() => void playFrom(i)} disabled={playback.busy} title="Play from this movement">{m.title}</button>
                      : m.title}
                    {now && <span className={s.nowWord}> — {playback.at?.playing ? 'now' : 'paused'}</span>}
                  </span>
                  {movementLength(sp?.trackDurationsMs, i) && <span className={s.movementLength}>{movementLength(sp?.trackDurationsMs, i)}</span>}
                </span>
                {/* Where in the movement it is: a hairline and a clock, carried by the clock between readings. */}
                {now && live && live.index === i && <MovementProgress progressMs={live.progressMs} durationMs={live.durationMs} />}
                {/* The companion's note, as Spotify reaches the movement — or every note, when Spotify can't say where it is. */}
                {notes[i] && (now || !spotify.connected) && <p className={s.movementNote}>{notes[i]}</p>}
              </li>
            )
          })}
        </ol>
      )}

      {/* A work in one track: its place, under the bar. */}
      {titled.length <= 1 && live && <p className={s.mtSm}><MovementProgress progressMs={live.progressMs} durationMs={live.durationMs} /></p>}
      {titled.length <= 1 && notes[0] && (nowIndex === 0 || !spotify.connected) && <p className={s.movementNote}>{notes[0]}</p>}

      {item.listenFor.length > 0 && (
        <>
          <p className={`${s.label} ${s.mtXl}`}>Listen for</p>
          <ul className={`${s.listenFor} ${s.listenForLarge}`}>
            {item.listenFor.map((l, i) => {
              const at = forAt[i]
              // Tied to a movement: its numeral in the margin; the ones for the movement sounding stand out, the rest step back.
              const here = at !== null && nowIndex !== null && at === nowIndex + 1
              const elsewhere = at !== null && nowIndex !== null && !here
              if (focus && elsewhere) return null
              return (
                // Tied to a movement, its numeral takes the note's place in the margin.
                <li key={i} className={[at !== null ? s.listenForTagged : '', here ? s.listenForNow : elsewhere ? s.listenForLater : ''].filter(Boolean).join(' ') || undefined} data-at={at !== null ? titled[at - 1]?.numeral ?? '' : undefined}>
                  {l}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {!focus && (<>
      {/* Ask about this: a question answered with the work, the recording and the movement sounding as context. */}
      <section className={s.companion} aria-label="Ask about this">
        <p className={s.label}>Ask about this</p>
        {/* Answers already read fold to their questions; the newest stays open, under the field it came from. */}
        {data.answers.map((a, i) => i < data.answers.length - 1 ? (
          <Twisty key={a.id} label="Asked" value={`${a.question}${a.movement ? ` · during ${a.movement}` : ''}`}>
            <Paragraphs text={a.body} className={s.prose} />
          </Twisty>
        ) : (
          <div key={a.id} className={s.answer}>
            <p className={s.answerQ}>{a.question}{a.movement ? <span className={s.faint}> · during {a.movement}</span> : null}</p>
            <Paragraphs text={a.body} className={s.prose} />
          </div>
        ))}
        {curatorReady ? (
          <form className={s.askRow} onSubmit={(e) => { e.preventDefault(); void ask() }}>
            <label className={s.visuallyHidden} htmlFor="ask">Your question</label>
            <input id="ask" className={s.input} maxLength={MAX_ASK} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why does the horn come back here?" disabled={asking} />
            <button className={`${s.outlineButton} ${s.smallButton}`} type="submit" disabled={asking || !question.trim()}>{asking ? 'Asking…' : 'Ask'}</button>
          </form>
        ) : <NeedsKey />}
        {curatorReady && <CharCount value={question} />}
        {/* The same note as on the programme, read once wherever it is first read. */}
        {data.explanation ? (
          <Twisty label="More context" value={data.explanation.heading} readOnce={`context:${programme.id}:${item.id}`}>
            <Paragraphs text={data.explanation.body} className={s.prose} />
          </Twisty>
        ) : curatorReady && (
          <button className={s.textButton} onClick={() => void explain()} disabled={explaining}>{explaining ? 'The curator is writing…' : 'More context'}</button>
        )}
      </section>
      </>)}

      {/* Heard: say how it landed here, then go straight on — no trip back up the programme. */}
      {heardOpen || data.heardBefore ? (
        <div className={`${s.panel} ${s.mtXl}`}>
          {/* Coming back to a work already heard: said so, and what was said is kept folded; open only if nothing was said yet. */}
          {!heardOpen && <p className={`${s.label} ${s.flush}`}>Heard</p>}
          <FeedbackPanel
            targets={[{ type: 'recording', id: played.recordingId, label: 'This recording' }, { type: 'work', id: item.workId, label: 'The work itself' }]}
            programmeId={programme.id}
            feedback={data.feedback}
            startOpen={heardOpen || !saidSomething}
          />
          <div className={`${s.actions} ${s.mtMd}`}>
            {/* The next work, ready: one tap opens it and — with Spotify connected — starts it. Nothing plays by itself. */}
            {next
              ? <a className={s.primaryButton} href={href({ name: 'listen', programmeId, itemId: next.id })} onClick={() => { if (spotify.connected) { try { sessionStorage.setItem(AUTOPLAY_KEY, next.id) } catch { /* private mode */ } } }}>
                  {spotify.connected ? 'Play next' : 'Next'}: {next.proposed.work} →
                </a>
              : <span className={s.quiet}>That was the last work this week.</span>}
            <a className={s.textButton} href={href({ name: 'programme', id: programme.id })}>Back to the programme</a>
          </div>
        </div>
      ) : (
        <div className={`${s.actions} ${s.mtXl}`}>
          <button className={s.primaryButton} onClick={() => void heard()} disabled={marking}>I’ve heard it</button>
        </div>
      )}
      {/* The Play row out of sight while this work is on: the player pinned to the foot. */}
      {sp && playback.at && barOut && (
        <MiniPlayer playback={playback} movement={titled[playback.at.index]} index={playback.at.index} count={sp.trackIds.length} progress={live} />
      )}
    </article>
  )
}

/**
 * The next work after this one that wasn't skipped: the next that can be
 * played (its recording, or a stand-in, confirmed on Spotify) if there is one,
 * else simply the next in programme order — without Spotify, or before it has
 * confirmed anything, the week is not over at its first work.
 */
function nextWork(items: ProgrammeItem[], current: ProgrammeItem, canPlay: (i: ProgrammeItem) => boolean, idsOf: (i: ProgrammeItem) => string[], events: Parameters<typeof listeningState>[0]): ProgrammeItem | undefined {
  const after = items.slice(items.findIndex((i) => i.id === current.id) + 1).filter((i) => listeningState(events, idsOf(i)) !== 'skipped')
  return after.find(canPlay) ?? after[0]
}
