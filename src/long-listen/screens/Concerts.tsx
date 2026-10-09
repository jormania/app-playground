import { useEffect, useRef, useState } from 'react'
import { Landmark } from 'lucide-react'
import type { Concert } from '../domain/types'
import { fold, surname } from '../domain/identity'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import type { ConcertDraft } from '../curation/journey'
import { openUrl, searchUrl } from '../spotify/client'
import { spotifyCandidates, type SpotifyCandidate } from '../spotify/verify'
import { resizePhoto } from '../../shared/photo'
import { Empty, Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

/** Where a picture shared to the app waits for this screen (public/long-listen-sw.js puts it there). */
export const SHARED_IMAGE = '/long-listen-shared-image'

/** "Thu 16 October 2026" */
export const concertDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))

/** "Orchestra Filarmonicii George Enescu · Gabriel Bebeșelea · Alexandra Conunova, violin" */
export const concertPerformers = (c: Pick<Concert, 'orchestra' | 'conductor' | 'soloists'>) =>
  [c.orchestra, c.conductor, ...c.soloists.map((x) => (x.instrument ? `${x.name}, ${x.instrument}` : x.name))].filter(Boolean).join(' · ')

/**
 * All concerts: every concert heard live, by venue and then date, newest first.
 * Each one also stands in the Journal, in the week it happened.
 */
export function ConcertsScreen() {
  const { repo } = useServices()
  const { data, error } = useLoad(() => repo.concerts.all(), [])
  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the concerts…</Waiting>
  const byVenue = new Map<string, Concert[]>()
  for (const c of [...data].sort((a, b) => b.date.localeCompare(a.date))) byVenue.set(c.venue, [...(byVenue.get(c.venue) ?? []), c])
  return (
    <div>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'journal' })}>← Journal</a></p>
      <h1 className={s.title}>Concerts</h1>
      <p className={s.dek}>What you heard live. Each work joins the Library, marked heard live, and the curator knows you’ve met it.</p>
      <div className={s.actions}>
        <a className={s.primaryButton} href={href({ name: 'concert', id: 'new' })}>Add a concert</a>
      </div>
      {data.length === 0 && <Empty>None yet. Share a screenshot of the hall’s programme to the app, or add one here.</Empty>}
      {[...byVenue.entries()].map(([venue, list]) => (
        <section key={venue} className={s.block}>
          <h2 className={s.h2}><Landmark size={18} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> {venue}</h2>
          <ul className={s.concertList}>
            {list.map((c) => (
              <li key={c.id} className={s.journalConcert}>
                {/* The evening as the title, the works one to a line beneath: never one long run-on link. */}
                <a className={`${s.journalConcertTitle} ${s.quietLink}`} href={href({ name: 'concert', id: c.id })}>{concertDate(c.date)}{c.hall ? ` · ${c.hall}` : ''}</a>
                {concertPerformers(c) && <p className={s.faint} style={{ margin: 0 }}>{concertPerformers(c)}</p>}
                <ul className={s.concertWorkList}>
                  {c.works.map((w, i) => <li key={i}>{w.composer.split(' ').slice(-1)[0]}, <em>{w.title}</em></li>)}
                </ul>
                {c.note && <p className={s.said}><q>{c.note}</q></p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** One concert: what was played, by whom, and ways to hear each work again. Or, for "new", the form. */
export function ConcertScreen({ id }: { id: string }) {
  const { repo } = useServices()
  const [editing, setEditing] = useState(false)
  const { data, error } = useLoad(async () => (id === 'new' ? null : repo.concerts.require(id)), [id])
  if (id === 'new') return <ConcertForm />
  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the concert…</Waiting>
  if (editing) return <ConcertForm concert={data} onDone={() => setEditing(false)} />
  const c = data
  return (
    <article>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'concerts' })}>← All concerts</a></p>
      <p className={s.composer}><Landmark size={16} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> Heard live · {c.venue}{c.hall ? `, ${c.hall}` : ''}</p>
      <h1 className={s.titleSmall}>{concertDate(c.date)}{c.time ? `, ${c.time}` : ''}</h1>
      {concertPerformers(c) && <p className={s.dek}>{concertPerformers(c)}</p>}
      {c.note && <p className={s.said}><q>{c.note}</q></p>}

      <ol className={s.concertWorks}>
        {c.works.map((w, i) => <ConcertWork key={`${i}-${w.workId}`} c={c} w={w} />)}
      </ol>

      <div className={s.actions} style={{ marginTop: 'var(--space-lg)' }}>
        <button className={s.outlineButton} onClick={() => setEditing(true)}>Edit</button>
      </div>
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
  const performers = [c.conductor, c.orchestra, ...c.soloists.map((x) => x.name)].filter((x): x is string => Boolean(x))
  const theirs = (cand: SpotifyCandidate) => performers.some((p) => cand.artists.some((a) => fold(a).includes(surname(p))))

  async function look() {
    setLooking(true)
    try {
      const list = await spotifyCandidates(spotify, { composer: w.composer, work: w.title, catalogue: w.catalogue, conductor: c.conductor, orchestra: c.orchestra, soloists: c.soloists }, 8)
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
      <p className={s.libraryTitle}>{w.composer} — {w.title}{w.catalogue ? `, ${w.catalogue}` : ''}</p>
      {found === null ? (
        spotify.connected
          ? <button className={`${s.outlineButton} ${s.smallButton}`} onClick={() => void look()} disabled={looking}>{looking ? 'Looking on Spotify…' : 'Hear it again'}</button>
          : <a className={`${s.outlineButton} ${s.smallButton}`} href={searchUrl(`${w.composer.split(' ').slice(-1)[0]} ${w.title}${w.catalogue ? ` ${w.catalogue}` : ''}`)} target="_blank" rel="noopener noreferrer">Look for it on Spotify</a>
      ) : found.length === 0 ? (
        <p className={s.note}>Spotify has nothing clearly of this work. <a href={searchUrl(`${w.composer.split(' ').slice(-1)[0]} ${w.title}${w.catalogue ? ` ${w.catalogue}` : ''}`)} target="_blank" rel="noopener noreferrer">Search it yourself</a>.</p>
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
function ConcertForm({ concert, onDone }: { concert?: Concert; onDone?: () => void }) {
  const { journey, curatorReady, bump, say } = useServices()
  const [d, setD] = useState<ConcertDraft>(concert ? { ...concert, works: concert.works.map(({ composer, title, catalogue }) => ({ composer, title, catalogue })) } : EMPTY)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function read(file: Blob): Promise<boolean> {
    setReading(true)
    try {
      const { promptVersion: _v, works, soloists, ...r } = await journey.readConcert(await asImage(file))
      // What the picture showed fills the form; what it left blank leaves the form as the listener had it.
      const shown = Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v === 'string' && v.trim())) as Partial<ConcertDraft>
      setD((x) => ({ ...x, ...shown, soloists: soloists.length ? soloists : x.soloists, works: works.length ? works : x.works, note: x.note, source: 'screenshot' }))
      return true
    } catch (e) {
      say(messageOf(e), 'danger')
      return false
    } finally {
      setReading(false)
    }
  }

  // A picture shared to the app waits in the cache: read it once, then let it go.
  useEffect(() => {
    if (concert || !curatorReady || typeof caches === 'undefined') return
    let live = true
    // Let go of it only once it has been read: a failed read (offline, busy) keeps it for the next try.
    void caches.match(SHARED_IMAGE).then(async (res) => {
      if (!res || !live) return
      if (!(await read(await res.blob()))) return
      await caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('long-listen-')).map((k) => caches.open(k).then((c) => c.delete(SHARED_IMAGE)))))
    }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concert, curatorReady])

  async function save() {
    setSaving(true)
    try {
      const c = await journey.saveConcert(d, concert?.id)
      bump()
      journey.scheduleTasteReading(bump)
      say('Kept. Its works are in the Library, heard live.', 'success')
      if (onDone) onDone()
      else go({ name: 'concert', id: c.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<ConcertDraft>) => setD((x) => ({ ...x, ...patch }))
  const setWork = (i: number, patch: Partial<ConcertDraft['works'][number]>) => set({ works: d.works.map((w, j) => (j === i ? { ...w, ...patch } : w)) })
  const setSoloist = (i: number, patch: Partial<ConcertDraft['soloists'][number]>) => set({ soloists: d.soloists.map((x, j) => (j === i ? { ...x, ...patch } : x)) })

  return (
    <div>
      <p className={s.eyebrow}><a className={`${s.quietLink} ${s.backLink}`} href={href({ name: 'concerts' })}>← All concerts</a></p>
      <h1 className={s.titleSmall}>{concert ? 'Correct the concert' : 'A concert heard live'}</h1>

      {curatorReady && (
        <div className={s.panel}>
          <p className={s.panelHead}>From a screenshot</p>
          <p className={s.quiet}>The hall’s programme page, or a photo of the printed one. The curator reads it into the form below; check it, then keep it.</p>
          <input ref={fileRef} type="file" accept="image/*" className={s.visuallyHidden} onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = '' }} />
          <button className={s.outlineButton} onClick={() => fileRef.current?.click()} disabled={reading}>{reading ? 'Reading the programme…' : 'Choose a screenshot'}</button>
        </div>
      )}

      <form className={s.concertForm} onSubmit={(e) => { e.preventDefault(); void save() }}>
        <label className={s.field}><span>Venue</span><input className={s.input} value={d.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="Filarmonica George Enescu" required /></label>
        <label className={s.field}><span>Hall</span><input className={s.input} value={d.hall ?? ''} onChange={(e) => set({ hall: e.target.value })} placeholder="Sala Mare (optional)" /></label>
        <div className={s.fieldRow}>
          <label className={s.field}><span>Date</span><input className={s.input} type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} required /></label>
          <label className={s.field}><span>Time</span><input className={s.input} type="time" value={d.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></label>
        </div>
        <label className={s.field}><span>Orchestra</span><input className={s.input} value={d.orchestra ?? ''} onChange={(e) => set({ orchestra: e.target.value })} /></label>
        <label className={s.field}><span>Conductor</span><input className={s.input} value={d.conductor ?? ''} onChange={(e) => set({ conductor: e.target.value })} /></label>

        <p className={s.label}>Soloists</p>
        {d.soloists.map((x, i) => (
          <div key={i} className={s.fieldRow}>
            <input className={s.input} aria-label="Soloist" value={x.name} onChange={(e) => setSoloist(i, { name: e.target.value })} placeholder="Name" />
            <input className={s.input} aria-label="Instrument" value={x.instrument ?? ''} onChange={(e) => setSoloist(i, { instrument: e.target.value })} placeholder="Instrument" />
            <button type="button" className={s.textButton} onClick={() => set({ soloists: d.soloists.filter((_, j) => j !== i) })} aria-label="Remove soloist">Remove</button>
          </div>
        ))}
        <button type="button" className={s.textButton} onClick={() => set({ soloists: [...d.soloists, { name: '' }] })}>Add a soloist</button>

        <p className={s.label} style={{ marginTop: 'var(--space-md)' }}>The works, in order</p>
        {d.works.map((w, i) => (
          // One work, two lines: who and which catalogue number, then its title at full width.
          <div key={i} className={s.workRow}>
            <span className={s.workNo}>{i + 1}</span>
            <input className={s.input} aria-label="Composer" value={w.composer} onChange={(e) => setWork(i, { composer: e.target.value })} placeholder="Composer" />
            <input className={s.input} aria-label="Catalogue" value={w.catalogue ?? ''} onChange={(e) => setWork(i, { catalogue: e.target.value })} placeholder="Op." />
            <input className={`${s.input} ${s.workTitleInput}`} aria-label="Work" value={w.title} onChange={(e) => setWork(i, { title: e.target.value })} placeholder="Work" />
            {d.works.length > 1 && <button type="button" className={`${s.textButton} ${s.workRemove}`} onClick={() => set({ works: d.works.filter((_, j) => j !== i) })} aria-label={`Remove work ${i + 1}`}>Remove</button>}
          </div>
        ))}
        <button type="button" className={s.textButton} onClick={() => set({ works: [...d.works, { composer: '', title: '' }] })}>Add a work</button>

        <label className={s.field} style={{ marginTop: 'var(--space-md)' }}><span>How was it?</span>
          <textarea className={s.textarea} value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Optional — a sentence is plenty. The curator reads it." />
        </label>
        <div className={s.actions}>
          <button className={s.primaryButton} type="submit" disabled={saving || reading}>{saving ? 'Keeping it…' : 'Keep this concert'}</button>
          {onDone && <button type="button" className={s.textButton} onClick={onDone}>Cancel</button>}
        </div>
      </form>
    </div>
  )
}
