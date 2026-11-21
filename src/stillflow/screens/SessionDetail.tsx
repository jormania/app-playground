import { useState } from 'react'
import { ArrowLeft, Heart, FolderPlus, CheckCircle2, MonitorPlay, Pencil, Share2, EyeOff, Eye, CalendarRange } from 'lucide-react'
import { hrefOf } from '../app/router'
import { seriesOfSession } from '../lib/series'
import { shareNative } from '../../shared/share'
import { useStillflow } from '../app/state'
import { BrowserLink, StartPractice } from '../components/StartPractice'
import { CollectionSheet, CompleteSheet } from '../components/Sheets'
import { ConfidenceNote, Empty, IntensityDots, SectionHead, RepeatRating, Thumb } from '../components/ui'
import type { PracticeEntry } from '../domain/types'
import { embedUrl } from '../lib/youtube'
import { descriptionLead, formatDay } from '../lib/practice'
import { repeatLabel } from '../domain/vocabulary'
import s from './screens.module.css'

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Description({ text }: { text: string }) {
  const [full, setFull] = useState(false)
  const { lead, rest } = descriptionLead(text)
  return (
    <>
      <p className={s.description}>{full ? text : lead}</p>
      {rest && <button type="button" className={s.textLink} style={{ marginTop: 'var(--space-xs)' }} onClick={() => setFull((v) => !v)}>{full ? 'Show less' : 'Show the full description'}</button>}
    </>
  )
}

export function SessionDetail({ id }: { id: string }) {
  const { byId, userData, history, toggleFavourite, setUserData, ready, seriesDefs, seriesProgress, toast } = useStillflow()
  const [embedded, setEmbedded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editing, setEditing] = useState<PracticeEntry | null>(null)
  const [collecting, setCollecting] = useState(false)
  const session = byId.get(id)

  if (!session) {
    return ready ? (
      <Empty title="Session not found">
        <p>It may have been removed from the catalogue.</p>
        <a className={s.textLink} href="#/explore">Back to Explore</a>
      </Empty>
    ) : null
  }

  const mine = userData[session.id] ?? { sessionId: session.id, favourite: false }
  const entries = history.filter((h) => h.sessionId === session.id)
  const canEmbed = !!session.youtubeVideoId
  const memberships = seriesOfSession(session, seriesDefs, seriesProgress)
  const share = async () => {
    const r = await shareNative({ name: session.title, description: `${session.durationMinutes} min · ${session.instructor}`, link: session.youtubeUrl }, 'Stillflow')
    if (r.copied) toast('Link copied')
  }

  const meta: [string, string[] | string | undefined][] = [
    ['Instructor', session.instructor],
    ['Style', session.styles],
    ['Body area', session.physicalFocus],
    ['Goal', session.objectives],
    ['Energy', session.energy],
    ['Level', session.experienceLevel],
    ['Time of day', session.timeOfDay],
    ['Equipment', session.equipment],
    ['Series', session.series],
    ['Posted on YouTube', formatDay(session.publishedDate)],
  ]

  return (
    <>
      <button type="button" className={s.back} onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.hash = '#/explore'))}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className={s.detail}>
        <div>
          {embedded && canEmbed ? (
            <iframe className={s.player} src={embedUrl(session.youtubeVideoId)} title={session.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <Thumb session={session} />
          )}

          <div className={s.actions}>
            <StartPractice session={session} />
            <div className={s.row} style={{ justifyContent: 'space-between' }}>
              {!session.isDemo && <BrowserLink session={session} />}
              {canEmbed && (
                <button type="button" className={s.textLink} onClick={() => setEmbedded((v) => !v)}>
                  <MonitorPlay size={14} style={{ verticalAlign: '-2px' }} /> {embedded ? 'Hide player' : 'Play here instead'}
                </button>
              )}
            </div>
            <div className={s.actionRow}>
              <button type="button" className={s.secondary} aria-pressed={mine.favourite} onClick={() => toggleFavourite(session.id)}>
                <Heart size={16} fill={mine.favourite ? 'currentColor' : 'none'} /> {mine.favourite ? 'Favourite' : 'Add to favourites'}
              </button>
              <button type="button" className={s.secondary} onClick={() => setCollecting(true)}>
                <FolderPlus size={16} /> Add to collection
              </button>
            </div>
            <button type="button" className={s.secondary} onClick={() => setCompleting(true)}>
              <CheckCircle2 size={16} /> Mark as done
            </button>
            <div className={s.row} style={{ justifyContent: 'space-between' }}>
              <button type="button" className={s.textLink} onClick={() => void share()}><Share2 size={14} style={{ verticalAlign: '-2px' }} /> Share</button>
              <button type="button" className={s.textLink} aria-pressed={!!mine.excluded}
                onClick={() => { setUserData({ ...mine, excluded: !mine.excluded }); toast(mine.excluded ? 'Back in suggestions' : 'Hidden from suggestions and Surprise Me') }}>
                {mine.excluded ? <><Eye size={14} style={{ verticalAlign: '-2px' }} /> Show in suggestions</> : <><EyeOff size={14} style={{ verticalAlign: '-2px' }} /> Hide from suggestions</>}
              </button>
            </div>
          </div>

          {session.tags.includes('unavailable') && (
            <p className={s.demoNote}>
              YouTube no longer plays this video: it was made private or removed. It stays in your history and is left out of
              suggestions. If it comes back, the next “Check for updates” notices.
            </p>
          )}
          {session.isDemo && (
            <p className={s.demoNote}>
              This is a demonstration record, not a real video. Start Practice opens a YouTube search for this kind of session.
              Add real sessions from Settings, by importing a file or pasting a YouTube link.
            </p>
          )}
        </div>

        <div>
          <div className={s.row}>
            {session.series && memberships.length === 0 && <span className={s.kicker} style={{ margin: 0 }}>{session.series}</span>}
            {memberships.map(({ def, day }) => (
              <a key={def.id} className={s.seriesChip} href={hrefOf({ name: 'seriesDetail', id: def.id })}>
                <CalendarRange size={12} /> {def.name} · {def.unit} {day}
              </a>
            ))}
            <ConfidenceNote session={session} />
          </div>
          <h1 className={s.detailTitle}>{session.title}</h1>
          <div className={s.facts}>
            <span>{session.durationMinutes} min</span>
            {session.intensity > 0 && <IntensityDots level={session.intensity} showLabel />}
            {session.publishedDate && <span>Posted {formatDay(session.publishedDate)}</span>}
          </div>

          <div className={s.spread} style={{ margin: 'var(--space-md) 0' }}>
            <span className={s.muted}>Practise it again?</span>
            <RepeatRating value={mine.rating} onChange={(r) => setUserData({ ...mine, rating: r })} />
          </div>

          <dl className={s.meta}>
            {meta.map(([label, value]) => {
              const list = Array.isArray(value) ? value : value ? [value] : []
              return (
                <div key={label} className={s.metaRow}>
                  <dt>{label}</dt>
                  <dd>{list.length ? (Array.isArray(value) ? <span className={s.tags}>{list.map((v) => <span key={v} className={s.tag}>{v}</span>)}</span> : list[0]) : <span className={s.muted}>{label === 'Series' || label === 'Posted on YouTube' ? '—' : 'Not set'}</span>}</dd>
                </div>
              )
            })}
          </dl>

          {session.description && (
            <>
              <SectionHead title="About" />
              <Description text={session.description} />
            </>
          )}

          <SectionHead title="Your practice" action={<a className={s.textLink} href={`#/settings/session/${encodeURIComponent(session.id)}`}><Pencil size={13} /> Edit details</a>} />
          {entries.length === 0 ? (
            <p className={s.muted}>Not practised yet. When you finish it, tap Mark as done.</p>
          ) : (
            <ul className={s.history}>
              {entries.map((e) => (
                <li key={e.id}>
                  <span>{formatDate(e.date)} · {e.minutes} min {e.rating ? `· ${repeatLabel(e.rating).toLowerCase()}` : ''}</span>
                  <button type="button" className={s.textLink} onClick={() => setEditing(e)}>Edit</button>
                  {e.note && <span className={s.historyNote}>{e.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {completing && <CompleteSheet open session={session} onClose={() => setCompleting(false)} />}
      {editing && <CompleteSheet key={editing.id} open session={session} entry={editing} onClose={() => setEditing(null)} />}
      {collecting && <CollectionSheet open session={session} onClose={() => setCollecting(false)} />}
    </>
  )
}
