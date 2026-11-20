import { useState } from 'react'
import { ArrowLeft, Heart, FolderPlus, CheckCircle2, MonitorPlay, Pencil } from 'lucide-react'
import { useStillflow } from '../app/state'
import { BrowserLink, StartPractice } from '../components/StartPractice'
import { CollectionSheet, CompleteSheet } from '../components/Sheets'
import { ConfidenceNote, Empty, IntensityDots, SectionHead, Stars, Thumb } from '../components/ui'
import type { PracticeEntry } from '../domain/types'
import { embedUrl } from '../lib/youtube'
import s from './screens.module.css'

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SessionDetail({ id }: { id: string }) {
  const { byId, userData, history, toggleFavourite, setUserData, ready } = useStillflow()
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

  const meta: [string, string[] | string | undefined][] = [
    ['Instructor', session.instructor],
    ['Style', session.styles],
    ['Physical focus', session.physicalFocus],
    ['Objectives', session.objectives],
    ['Energy', session.energy],
    ['Experience', session.experienceLevel],
    ['Time of day', session.timeOfDay],
    ['Equipment', session.equipment],
    ['Series', session.series],
    ['Published', session.publishedDate],
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
              <CheckCircle2 size={16} /> Mark as completed
            </button>
          </div>

          {session.isDemo && (
            <p className={s.demoNote}>
              This is a demonstration record, not a real video. Start Practice opens a YouTube search for this kind of session.
              Add real sessions from Settings, by importing a file or pasting a YouTube link.
            </p>
          )}
        </div>

        <div>
          <div className={s.row}>
            {session.series && <span className={s.kicker} style={{ margin: 0 }}>{session.series}</span>}
            <ConfidenceNote session={session} />
          </div>
          <h1 className={s.detailTitle}>{session.title}</h1>
          <div className={s.facts}>
            <span>{session.durationMinutes} min</span>
            <IntensityDots level={session.intensity} showLabel />
          </div>

          <div className={s.spread} style={{ margin: 'var(--space-md) 0' }}>
            <span className={s.muted}>Your rating</span>
            <Stars value={mine.rating} label="Your rating" onChange={(r) => setUserData({ ...mine, rating: r })} />
          </div>

          <dl className={s.meta}>
            {meta.map(([label, value]) => {
              const list = Array.isArray(value) ? value : value ? [value] : []
              return (
                <div key={label} className={s.metaRow}>
                  <dt>{label}</dt>
                  <dd>{list.length ? (Array.isArray(value) ? <span className={s.tags}>{list.map((v) => <span key={v} className={s.tag}>{v}</span>)}</span> : list[0]) : <span className={s.muted}>{label === 'Series' || label === 'Published' ? '—' : 'Not classified'}</span>}</dd>
                </div>
              )
            })}
          </dl>

          {session.description && (
            <>
              <SectionHead title="About" />
              <p className={s.description}>{session.description}</p>
            </>
          )}

          <SectionHead title="Your practice" action={<a className={s.textLink} href={`#/settings/session/${encodeURIComponent(session.id)}`}><Pencil size={13} /> Edit details</a>} />
          {entries.length === 0 ? (
            <p className={s.muted}>Not practised yet. Use Mark as completed when you’ve finished.</p>
          ) : (
            <ul className={s.history}>
              {entries.map((e) => (
                <li key={e.id}>
                  <span>{formatDate(e.date)} · {e.minutes} min {e.rating ? `· ${'★'.repeat(e.rating)}` : ''}</span>
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
