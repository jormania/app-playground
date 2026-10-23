import { useEffect, useRef, useState } from 'react'
import { Landmark } from 'lucide-react'
import { ConfirmModal } from '../../ds'
import type { Concert } from '../domain/types'
import { displaySurname, fold } from '../domain/identity'
import { isCredited } from '../spotify/match'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import type { ConcertDraft } from '../curation/journey'
import { openUrl, searchUrl } from '../spotify/client'
import { spotifyCandidates, type SpotifyCandidate } from '../spotify/verify'
import { resizePhoto } from '../../shared/photo'
import { CharCount, Empty, MAX_ASK, NeedsKey, Problem, Waiting, messageOf, webUrl } from '../components/common'
import { Credits } from '../components/Credits'
import { ConcertEntry, concertDate } from '../components/ConcertEntry'
import { unplaced, whoPlays } from '../domain/concertSoloists'
import { namedSoloists, playingKeys, removeSoloist, soloistKey, toDraft, toForm, toggleSoloist, type ConcertFormState } from '../domain/concertForm'
import { AlreadyKept, ConcertRefused, draftFrom, goingStage, whenWords, type Going } from '../domain/going'
import { GoingToggle, useGoings } from '../components/Going'
import { listeningState } from '../domain/listening'
import { heardAs, standInsOf } from '../domain/standIns'
import { isoDateIn } from '../domain/week'
import { liveEvents, liveMatches, venueShort, whatIsOnAt } from '../live/live'
import { NotFound } from '../store/repo'
import s from '../styles/editorial.module.css'
import { useTitle } from '../app/title'
import { BackLink } from '../components/BackLink'
import { passing } from '../curation/api'

/** Where a picture shared to the app waits for this screen (public/long-listen-sw.js puts it there). */
export const SHARED_IMAGE = '/long-listen-shared-image'
/** How long a shared picture waits to be read (say, for a key to be added) before it is let go unread. */
const SHARED_IMAGE_KEEP_MS = 24 * 3600_000

export { concertDate }

/**
 * All concerts: every concert heard live, newest first — one list, not one per
 * venue (a hall written two ways split in two). Each one also stands in the
 * Journal, in the week it happened.
 */
export function ConcertsScreen() {
  const { repo, settings } = useServices()
  const { data, error, retry } = useLoad(() => repo.concerts.all(), [])
  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the concerts…</Waiting>
  // A concert kept before its date (possible before dates were checked) isn't heard yet: apart, to correct or remove.
  const today = isoDateIn(new Date(), settings.timeZone)
  const heard = data.filter((c) => c.date <= today)
  const early = data.filter((c) => c.date > today)
  return (
    <div>
      <BackLink back to={href({ name: 'journal' })} label="Journal" />
      <h1 className={s.title}>Concerts</h1>
      <p className={s.dek}>What you heard live. Each work joins the Library, marked heard live, and the curator knows you’ve met it.</p>
      <div className={s.actions}>
        <a className={s.primaryButton} href={href({ name: 'concert', id: 'new' })}>Add a concert</a>
      </div>
      <YoureGoing />
      <FromYourListening />
      {heard.length === 0
        ? <Empty>None yet. Share a screenshot of the hall’s programme to the app, or add one here.</Empty>
        : (
          <ul className={`${s.concertList} ${s.block}`} aria-label="Concerts heard live">
            {[...heard].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map((c) => <li key={c.id}><ConcertEntry concert={c} /></li>)}
          </ul>
        )}
      {early.length > 0 && (
        <section className={s.block} aria-label="Kept before the evening">
          <p className={s.label}>Kept before the evening</p>
          <p className={s.quiet}>Not counted as heard until its date. Open one to correct the date or remove it.</p>
          <ul className={s.concertList}>
            {early.map((c) => <li key={c.id}><ConcertEntry concert={c} /></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}

/** One concert: what was played, by whom, and ways to hear each work again. Or, for "new", the form. */
export function ConcertScreen({ id }: { id: string }) {
  const { repo, journey, bump, say, settings } = useServices()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fromGoing = id.startsWith('from-') ? id.slice('from-'.length) : undefined
  const { data, error, retry } = useLoad(async () => (id === 'new' || fromGoing ? null : repo.concerts.require(id)), [id])
  useTitle(id === 'new' || fromGoing ? 'A concert heard' : data ? `${data.venue}, ${data.date}` : undefined)
  if (id === 'new') return <ConcertForm />
  if (fromGoing) return <ConcertFromGoing goingKey={fromGoing} />
  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'There’s no such concert — perhaps an old link.', link: { href: href({ name: 'concerts' }), label: 'All concerts' } }} />
  if (!data) return <Waiting>Opening the concert…</Waiting>
  if (editing) return <ConcertForm concert={data} onDone={() => setEditing(false)} />
  const c = data

  async function remove() {
    setRemoving(false)
    try {
      await journey.deleteConcert(c.id)
      bump()
      say('Removed from your concerts.', 'success')
      go({ name: 'concerts' })
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }
  return (
    <article>
      <BackLink back to={href({ name: 'concerts' })} label="All concerts" />
      <p className={s.composer}><Landmark size={16} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> {c.date > isoDateIn(new Date(), settings.timeZone) ? 'Not yet heard' : 'Heard live'} · {c.venue}{c.hall ? `, ${c.hall}` : ''}</p>
      <h1 className={s.titleSmall}>{concertDate(c.date)}{c.time ? `, ${c.time}` : ''}</h1>
      {/* Who played, as the hall's own programme prints it: name first, the role after in italic. */}
      <Credits r={{ conductor: c.conductor, orchestra: c.orchestra, soloists: unplaced(c) }} className={s.concertCredits} programme />
      {c.note && <p className={s.said}><q>{c.note}</q></p>}

      {/* The evening's order of performance, set like the programme's running order. */}
      <section className={s.concertProgramme} aria-label="The programme">
        <p className={s.panelHead}>The programme</p>
        <ol className={s.concertWorks}>
          {c.works.map((w, i) => <ConcertWork key={`${i}-${w.workId}`} c={c} w={w} />)}
        </ol>
      </section>

      {/* A correction is rare, and the page is for the music: a text link, after it. */}
      <div className={`${s.actions} ${s.mtLg}`}>
        <button className={`${s.textButton} ${s.quietButton}`} onClick={() => setEditing(true)}>Correct the concert</button>
        <button className={`${s.textButton} ${s.quietButton}`} onClick={() => setRemoving(true)}>Remove this concert</button>
      </div>
      <ConfirmModal
        isOpen={removing}
        title="Remove this concert?"
        message="It leaves your concerts, the Journal and the Library’s “heard live”, with what you said of it. The curator won’t know of it any more."
        confirmText="Remove it"
        variant="danger"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(false)}
      />
    </article>
  )
}

/**
 * A work from the concert, and how to hear it again: Spotify's recordings of
 * it, the same performers' own first when Spotify really has one — never
 * claimed when it hasn't.
 */
function ConcertWork({ c, w }: { c: Concert; w: Concert['works'][number] }) {
  const { spotify, say } = useServices()
  const [found, setFound] = useState<SpotifyCandidate[] | null>(null)
  const [looking, setLooking] = useState(false)
  // Only the soloists who played this work: the evening's cellist is no clue to its symphony's recordings.
  const soloists = whoPlays(c, w)
  const people = [c.conductor, ...soloists.map((x) => x.name)].filter((x): x is string => Boolean(x))
  // The same performers: a person credited by surname, as the matcher credits them (spotify/match.ts);
  // the orchestra by its whole name, either way round — never by a surname taken from it.
  const orchestraIn = (artists: string[]) => {
    const o = c.orchestra ? fold(c.orchestra) : ''
    return o.length > 3 && artists.some((a) => { const f = fold(a); return f.length > 3 && (f === o || f.includes(o) || o.includes(f)) })
  }
  const theirs = (cand: SpotifyCandidate) => people.some((p) => isCredited(p, cand.artists.map((name) => ({ name })))) || orchestraIn(cand.artists)
  const query = `${displaySurname(w.composer)} ${w.title}${w.catalogue ? ` ${w.catalogue}` : ''}`

  async function look() {
    setLooking(true)
    try {
      const list = await spotifyCandidates(spotify, { composer: w.composer, work: w.title, catalogue: w.catalogue, conductor: c.conductor, orchestra: c.orchestra, soloists }, 8)
      // Their own recording first, then the rest, at most three in all.
      setFound([...list.filter(theirs).slice(0, 1), ...list.filter((x) => !theirs(x))].slice(0, 3))
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setLooking(false)
    }
  }

  return (
    <li>
      <p className={s.composer}><a href={href({ name: 'composer', composer: w.composer })} className={s.composerLink}>{w.composer}</a></p>
      <p className={s.libraryTitle}>{w.title}{w.catalogue ? `, ${w.catalogue}` : ''}</p>
      <Credits r={{ soloists }} className={s.workCredits} programme />
      {found === null ? (
        // One quiet link a work: the page is the evening's music and who played it, and a
        // full button under every work made the ways back to Spotify the loudest thing on it.
        <p className={s.concertLook}>
          {spotify.connected
            ? <button className={s.textButton} onClick={() => void look()} disabled={looking}>{looking ? 'Looking on Spotify…' : 'Hear it again on Spotify'}</button>
            : <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Look for it on Spotify ↗</a>}
        </p>
      ) : found.length === 0 ? (
        <p className={s.note}>Spotify has nothing clearly of this work. <a href={searchUrl(query)} target="_blank" rel="noopener noreferrer">Search it yourself</a>.</p>
      ) : (
        <ul className={s.bullets}>
          {found.map((x, i) => (
            <li key={x.albumId ?? x.album}>
              <span className={s.label}>{theirs(x) ? 'The same performers' : i === (theirs(found[0]) ? 1 : 0) ? 'A recording to start from' : 'Another way to hear it'}</span>{' '}
              {x.albumId ? <a href={openUrl('album', x.albumId)} target="_blank" rel="noopener noreferrer">{x.artists.join(', ')}</a> : x.artists.join(', ')}
              {/* Which work Spotify says it is, when that says more than the programme did: "Cello Concerto No. 1, Op. 29". */}
              {x.title && fold(x.title) !== fold(`${w.title}${w.catalogue ? ` ${w.catalogue}` : ''}`) && <span> · {x.title}</span>}
              <span className={s.faint}> · {x.album}{x.year ? `, ${x.year}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Concerts coming up at the halls the app reads (Live in Bucharest) that meet
 * what you have heard here — the very work, a performer from its recording,
 * or its composer — not only this week's programme. Liked or loved first among
 * works heard; five concerts at most, closest matches first. No calls to the
 * curator: the halls' listings are read once a day, as for the programme.
 */
function FromYourListening() {
  const { repo, settings } = useServices()
  const goings = useGoings()
  const today = isoDateIn(new Date(), settings.timeZone)
  const { data } = useLoad(async () => {
    const [programmes, events, feedback, comparisons] = await Promise.all([repo.programmes.all(), repo.events.all(), repo.feedback.all(), repo.comparisons.all()])
    const standIns = standInsOf(comparisons)
    const warm = new Set(feedback.filter((f) => f.reaction === 'loved' || f.reaction === 'interesting').map((f) => f.target.id))
    // Each work heard, once, as the programme item it was heard in — the warmest first.
    const seen = new Set<string>()
    const items = programmes.flatMap((p) => p.sections.flatMap((x) => x.items).map((i) => ({ i, ids: heardAs(i, p.id, standIns) })))
      .filter(({ ids }) => listeningState(events, ids) === 'heard')
      .sort((a, b) => Number(b.ids.some((x) => warm.has(x)) || warm.has(b.i.workId)) - Number(a.ids.some((x) => warm.has(x)) || warm.has(a.i.workId)))
      .filter(({ i }) => (seen.has(i.workId) ? false : (seen.add(i.workId), true)))
      .map(({ i }) => i)
    if (!items.length || !programmes.length) return []
    const heardSoFar = { ...programmes[0], sections: [{ ...programmes[0].sections[0], items }] }
    return liveMatches(heardSoFar, await liveEvents(repo.marks), today).slice(0, 5)
  }, [today])
  if (!data?.length) return null
  return (
    <section className={s.block} aria-label="From your listening">
      <p className={s.label}>From your listening</p>
      <p className={s.quiet}>Coming up in Bucharest, with music you’ve heard here.</p>
      <ul className={s.bullets}>
        {data.map((c) => (
          <li key={c.key}>
            {whatIsOnAt(c)} at {venueShort(c.event.venue)} {whenWords(c.event.date, today, c.event.time)}
            {c.event.link && webUrl(c.event.link) && <> · <a href={webUrl(c.event.link)} target="_blank" rel="noopener noreferrer">{c.event.title}</a></>}
            {' '}<GoingToggle event={c.event} goings={goings} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Concerts marked as going, still ahead — to the preparation once it is written, in the week before. */
function YoureGoing() {
  const { settings } = useServices()
  const today = isoDateIn(new Date(), settings.timeZone)
  const ahead = useGoings().filter((g) => ['later', 'ahead'].includes(goingStage(g, today)))
  if (!ahead.length) return null
  return (
    <section className={s.block} aria-label="You’re going">
      <p className={s.label}>You’re going</p>
      <ul className={s.bullets}>
        {ahead.map((g) => (
          <li key={g.key}>
            {goingStage(g, today) === 'ahead' ? <a className={s.quietLink} href={href({ name: 'before', key: g.key })}>{g.event.title}</a> : g.event.title}
            <span className={s.faint}> · at {venueShort(g.event.venue)} {whenWords(g.event.date, today, g.event.time)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * After a concert marked as going: the entry, filled in from the hall's
 * listing and the preparation's reading of it. Read now if it never was — the
 * same call, kept, so going back and forth costs nothing.
 */
function ConcertFromGoing({ goingKey }: { goingKey: string }) {
  const { repo, journey, curatorReady, bump } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const going = (await repo.marks.get(`going:${goingKey}`))?.value as Going | undefined
    if (!going) throw new NotFound(`no concert marked ${goingKey}`)
    if (going.concertId) return { kept: going.concertId }
    return { going, prep: await journey.preparation(goingKey) }
  }, [goingKey])
  // Never read (the page opened before it): read now, once per visit — asked from an effect, not the
  // loader, which runs again on every refresh and would pay again each time a failed reading is retried.
  const [reading, setReading] = useState<'idle' | 'reading' | 'done'>('idle')
  const asked = useRef(false)
  const needsReading = Boolean(data && !data.kept && !data.prep && curatorReady)
  useEffect(() => {
    if (!needsReading || asked.current) return
    asked.current = true
    setReading('reading')
    journey.prepare(goingKey).then(bump, () => {}).finally(() => setReading('done'))
  }, [needsReading, journey, goingKey, bump])
  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'That concert isn’t marked as one you went to.', link: { href: href({ name: 'concerts' }), label: 'All concerts' } }} />
  if (!data || (needsReading && reading !== 'done')) return <Waiting>Filling it in from the hall’s programme…</Waiting>
  if (data.kept) return <ConcertScreen id={data.kept} />
  // Keyed by whether the reading came, so the form starts from it (the form reads its start once).
  return <ConcertForm key={data.prep ? 'read' : 'unread'} start={draftFrom(data.going!, data.prep)} goingKey={goingKey} />
}

const EMPTY: ConcertDraft = { venue: '', date: '', soloists: [], works: [{ composer: '', title: '' }], source: 'typed' }

/** A picture as the curator takes it: downscaled (a screenshot needs no more), base64. */
async function asImage(file: Blob): Promise<{ mediaType: string; data: string }> {
  const small = await resizePhoto(file as Blob & { type: string }, { maxEdge: 1600 })
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(small)
  })
  return { mediaType: small.type || 'image/jpeg', data }
}

/**
 * Adding (or correcting) a concert. A screenshot of the hall's programme —
 * shared to the app from the phone's share sheet, or chosen here — is read by
 * the curator into the form, Romanian programmes included; everything stays
 * editable, and typing it in is always possible.
 */
function ConcertForm({ concert, onDone, start, goingKey }: { concert?: Concert; onDone?: () => void; /** A new concert's form, already filled (a concert marked as going). */ start?: ConcertDraft; goingKey?: string }) {
  const { journey, curatorReady, bump, say } = useServices()
  const [d, setD] = useState<ConcertFormState>(() => toForm(concert ? { ...concert, works: concert.works.map(({ composer, title, catalogue, soloists }) => ({ composer, title, catalogue, soloists })) } : start ?? EMPTY))
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function read(file: Blob): Promise<boolean> {
    setReading(true)
    try {
      const { promptVersion: _v, works, soloists, ...r } = await journey.readConcert(await asImage(file))
      // What the picture showed fills the form; what it left blank leaves the form as the listener had it.
      const shown = Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v === 'string' && v.trim())) as Partial<ConcertDraft>
      setD((x) => {
        // Merged by name, then given rows afresh: a work read from the picture names its soloists, not their rows.
        const was = toDraft(x)
        return toForm({ ...was, ...shown, soloists: soloists.length ? soloists : was.soloists, works: works.length ? works : was.works, note: was.note, source: 'screenshot' })
      })
      return true
    } catch (e) {
      say(messageOf(e), 'danger')
      // Done with the picture unless the failure was in passing (offline, busy): one that can't be read
      // would be sent, and paid for, again on every opening of this form.
      return !passing(e)
    } finally {
      setReading(false)
    }
  }

  // A picture shared to the app waits in the cache: read it once, then let it go.
  useEffect(() => {
    if (concert || start || !curatorReady || typeof caches === 'undefined') return
    let live = true
    // Let go of it once it has been read — a failed read (offline, busy) keeps it for the next try — or, unread, once it is
    // more than a day old: a picture shared weeks ago isn't what the listener means to add now, and reading it costs.
    const letGo = () => caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('long-listen-')).map((k) => caches.open(k).then((c) => c.delete(SHARED_IMAGE)))))
    void caches.match(SHARED_IMAGE).then(async (res) => {
      if (!res || !live) return
      const at = Number(res.headers.get('x-shared-at'))
      if (!at || Date.now() - at > SHARED_IMAGE_KEEP_MS) { await letGo(); return }
      if (await read(await res.blob())) await letGo()
    }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concert, curatorReady])

  // A ref as well as the state: two taps (or a tap and Enter) in one frame both see the state as it was.
  const savingNow = useRef(false)
  async function save() {
    if (savingNow.current) return
    savingNow.current = true
    setSaving(true)
    try {
      const c = await journey.saveConcert(toDraft(d), concert?.id)
      // Kept from a concert marked as going: its card on the week has done its work.
      if (goingKey) await journey.concertKept(goingKey, c.id)
      bump()
      journey.scheduleTasteReading(bump)
      say('Kept. Its works are in the Library, heard live.', 'success')
      if (onDone) onDone()
      else go({ name: 'concert', id: c.id })
    } catch (e) {
      if (!(e instanceof AlreadyKept)) { say(e instanceof ConcertRefused ? e.message : messageOf(e), 'danger'); return }
      // That evening is already kept (shared twice, or entered before): open it rather than keep it twice.
      if (goingKey) await journey.concertKept(goingKey, e.concertId).catch(() => {})
      bump()
      say(e.message)
      go({ name: 'concert', id: e.concertId })
    } finally {
      savingNow.current = false
      setSaving(false)
    }
  }

  const set = (patch: Partial<ConcertFormState>) => setD((x) => ({ ...x, ...patch }))
  const setWork = (i: number, patch: Partial<ConcertFormState['works'][number]>) => setD((x) => ({ ...x, works: x.works.map((w, j) => (j === i ? { ...w, ...patch } : w)) }))
  // A soloist renamed keeps their place in the works they play: the works hold the row's key, not its name.
  const setSoloist = (key: string, patch: Partial<ConcertFormState['soloists'][number]>) => setD((x) => ({ ...x, soloists: x.soloists.map((y) => (y.key === key ? { ...y, ...patch } : y)) }))
  const named = namedSoloists(d)

  const chooser = <input ref={fileRef} type="file" accept="image/*" className={s.visuallyHidden} onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = '' }} />
  const howWasIt = (
    <>
      <label className={`${s.field} ${start ? '' : s.mtMd}`}><span>How was it?</span>
        <textarea className={s.textarea} maxLength={MAX_ASK} value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Optional — a sentence is plenty. The curator reads it." />
      </label>
      <CharCount value={d.note ?? ''} />
    </>
  )

  return (
    <div>
      <BackLink back to={href({ name: start ? 'week' : 'concerts' })} label={start ? 'This week' : 'All concerts'} />
      <h1 className={s.titleSmall}>{concert ? 'Correct the concert' : 'A concert heard live'}</h1>

      {start
        // Filled from the listing: one line on what to check, and the screenshot only as a way out, under the works.
        ? <p className={s.quiet}>{start.works.some((w) => w.composer.trim() && w.title.trim())
          ? 'Filled in from the hall’s programme — check it, then keep it.'
          : 'Only the date and place could be filled in — add the works, or read a screenshot.'}</p>
        // Offered with or without a key — without one, it says what it needs, like every curator request.
        : <div className={s.panel}>
          <p className={s.panelHead}>From a screenshot</p>
          <p className={s.quiet}>The hall’s programme page, or a photo of the printed one. The curator reads it into the form below; check it, then keep it.</p>
          {chooser}
          <div className={s.actions}>
            <button className={s.outlineButton} onClick={() => fileRef.current?.click()} disabled={reading || !curatorReady}>{reading ? 'Reading the programme…' : 'Choose a screenshot'}</button>
          </div>
          {!curatorReady && <NeedsKey to="have the curator read it" />}
        </div>}

      <form className={s.concertForm} onSubmit={(e) => { e.preventDefault(); void save() }}>
        {start && howWasIt}
        <label className={s.field}><span>Venue</span><input className={s.input} value={d.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="Filarmonica George Enescu" required /></label>
        <label className={s.field}><span>Hall</span><input className={s.input} value={d.hall ?? ''} onChange={(e) => set({ hall: e.target.value })} placeholder="Sala Mare (optional)" /></label>
        <div className={s.fieldRow}>
          <label className={s.field}><span>Date</span><input className={s.input} type="date" value={d.date} max={journey.today()} onChange={(e) => set({ date: e.target.value })} required /></label>
          <label className={s.field}><span>Time</span><input className={s.input} type="time" value={d.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></label>
        </div>
        <label className={s.field}><span>Orchestra</span><input className={s.input} value={d.orchestra ?? ''} onChange={(e) => set({ orchestra: e.target.value })} /></label>
        <label className={s.field}><span>Conductor</span><input className={s.input} value={d.conductor ?? ''} onChange={(e) => set({ conductor: e.target.value })} /></label>

        <p className={s.label}>Soloists</p>
        {named.length > 0 && <p className={`${s.settingHint} ${s.flush}`}>Under each work, mark who plays in it — a soloist rarely plays the whole evening.</p>}
        {d.soloists.map((x) => (
          <div key={x.key} className={s.fieldRow}>
            <input className={s.input} aria-label="Soloist" value={x.name} onChange={(e) => setSoloist(x.key, { name: e.target.value })} placeholder="Name" />
            <input className={s.input} aria-label="Instrument" value={x.instrument ?? ''} onChange={(e) => setSoloist(x.key, { instrument: e.target.value })} placeholder="Instrument" />
            <button type="button" className={s.textButton} onClick={() => setD((f) => removeSoloist(f, x.key))} aria-label={`Remove ${x.name.trim() || 'this soloist'}`}>Remove</button>
          </div>
        ))}
        <button type="button" className={s.textButton} onClick={() => set({ soloists: [...d.soloists, { key: soloistKey(), name: '' }] })}>Add a soloist</button>

        <p className={`${s.label} ${s.mtMd}`}>The works, in order</p>
        {d.works.map((w, i) => (
          // One work, two lines: who and which catalogue number, then its title at full width.
          <div key={i} className={s.workRow}>
            <span className={s.workNo}>{i + 1}</span>
            <input className={s.input} aria-label={`Composer, work ${i + 1}`} value={w.composer} onChange={(e) => setWork(i, { composer: e.target.value })} placeholder="Composer" />
            <input className={s.input} aria-label={`Catalogue, work ${i + 1}`} value={w.catalogue ?? ''} onChange={(e) => setWork(i, { catalogue: e.target.value })} placeholder="Op." />
            <input className={`${s.input} ${s.workTitleInput}`} aria-label={`Title, work ${i + 1}`} value={w.title} onChange={(e) => setWork(i, { title: e.target.value })} placeholder="Work" />
            {named.length > 0 && (
              <div className={`${s.chipRow} ${s.workSoloists}`} role="group" aria-label={`Who plays in work ${i + 1}`}>
                {named.map((x) => {
                  const on = playingKeys(d, w).includes(x.key)
                  return <button key={x.key} type="button" aria-pressed={on} className={`${s.chip} ${on ? s.chipOn : ''}`} onClick={() => setD((f) => toggleSoloist(f, i, x.key))}>{displaySurname(x.name)}</button>
                })}
              </div>
            )}
            {d.works.length > 1 && <button type="button" className={`${s.textButton} ${s.workRemove}`} onClick={() => set({ works: d.works.filter((_, j) => j !== i) })} aria-label={`Remove work ${i + 1}`}>Remove</button>}
          </div>
        ))}
        <button type="button" className={s.textButton} onClick={() => set({ works: [...d.works, { composer: '', title: '' }] })}>Add a work</button>
        {start && (
          <>
            <p className={`${s.quiet} ${s.mtMd}`}>
              {chooser}
              Programme changed on the night?{' '}
              <button type="button" className={`${s.textButton} ${s.inlineButton}`} onClick={() => fileRef.current?.click()} disabled={reading || !curatorReady}>{reading ? 'Reading the programme…' : 'Read a screenshot instead.'}</button>
            </p>
            {!curatorReady && <NeedsKey to="have the curator read it" />}
          </>
        )}

        {!start && howWasIt}
        <div className={s.actions}>
          <button className={s.primaryButton} type="submit" disabled={saving || reading}>{saving ? 'Keeping it…' : 'Keep this concert'}</button>
          <button type="button" className={s.textButton} onClick={() => (onDone ? onDone() : go({ name: start ? 'week' : 'concerts' }))}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
