import type { ReactNode } from 'react'
import type { SeriesDef, Session } from '../domain/types'
import { hrefOf } from '../app/router'
import { useStillflow } from '../app/state'
import { dayTheme, daySearchUrl } from '../lib/series'
import { PracticeLink, StartPractice } from './StartPractice'
import { Thumb } from './ui'
import s from '../screens/screens.module.css'

/**
 * One practice, offered: the shape shared by Today's "Your next practice", its
 * "Or something else" pick and the series page's "Up next", so the three never
 * drift apart. Top to bottom, always in this order:
 *
 *   thumbnail (the length on its badge) | label · title · one line of meta
 *   an italic note (the series pace, or why this was picked)
 *   anything particular to the card (Today's 10/20/30 minutes)
 *   Start, and one quiet companion (a link or a tag) on the same row
 *
 * Each card fills the slots it has; none adds elements of its own elsewhere.
 *
 * `actionsBeside` is for a series day: its thumbnail already shows the day and
 * its theme, so the text goes and Start sits beside it, its companion below.
 */
export function PracticeBlock({ session, label, title, meta, note, extra, start, secondary, actionsBeside = false }: {
  session?: Session
  label?: string
  title: string
  meta?: ReactNode
  note?: ReactNode
  extra?: ReactNode
  start: ReactNode
  secondary?: ReactNode
  actionsBeside?: boolean
}) {
  if (actionsBeside && session) {
    return (
      <>
        <div className={s.pickBeside}>
          <a href={hrefOf({ name: 'session', id: session.id })} className={s.pickBesideThumb} aria-label={label ? `${label}: ${title}` : title}>
            <Thumb session={session} className={s.todayThumb} />
          </a>
          <div className={s.pickBesideActions}>
            {start}
            {secondary}
          </div>
        </div>
        {note && <span className={s.paceNote}>{note}</span>}
        {extra}
      </>
    )
  }
  const text = (
    <span>
      {label && <span className={s.entrySource}>{label}</span>}
      <strong className={s.todayTitle}>{title}</strong>
      {meta && <span className={s.muted}>{meta}</span>}
    </span>
  )
  return (
    <>
      {session ? (
        <a href={hrefOf({ name: 'session', id: session.id })} className={s.todayPick}>
          <Thumb session={session} className={s.todayThumb} />
          {text}
        </a>
      ) : (
        <div className={s.todayPlain}>{text}</div>
      )}
      {note && <span className={s.paceNote}>{note}</span>}
      {extra}
      <div className={s.todayActions}>
        {start}
        {secondary}
      </div>
    </>
  )
}

/** The next day of a series, in the shared shape. */
export function NextDay({ def, day, session, withSeries, meta, note, secondary, actionsBeside }: {
  def: SeriesDef
  day: number
  session?: Session
  /** Name the series in the label (on Today); the series page already says which. */
  withSeries: boolean
  meta?: ReactNode
  note?: ReactNode
  secondary?: ReactNode
  actionsBeside?: boolean
}) {
  const { markLaunched } = useStillflow()
  return (
    <PracticeBlock
      session={session}
      label={withSeries ? `${def.name} · ${def.unit} ${day}` : `${def.unit} ${day}`}
      title={(session && dayTheme(session.title, def)) || `${def.unit} ${day}`}
      meta={session ? meta : 'Not in your library yet: opens a YouTube search'}
      note={note}
      start={session
        ? <StartPractice session={session} compact series={{ seriesId: def.id, day }} label={`Start ${def.unit} ${day}`} />
        : <PracticeLink url={daySearchUrl(def, day)} compact search label={`Find ${def.unit} ${day}`} ariaLabel={`Find ${def.unit} ${day} on YouTube`} onLaunch={() => markLaunched({ seriesId: def.id, day })} />}
      secondary={secondary}
      actionsBeside={actionsBeside}
    />
  )
}
