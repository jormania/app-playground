import { Heart } from 'lucide-react'
import type { Session } from '../domain/types'
import { repeatLabel } from '../domain/vocabulary'
import { formatDay, formatMonth } from '../lib/practice'
import { hrefOf } from '../app/router'
import { useStillflow } from '../app/state'
import { cx } from '../../ds/lib/cx'
import { IntensityDots, Thumb } from './ui'
import { isUnavailable, shortTitle } from '../lib/today'
import styles from './SessionCard.module.css'

export function SessionCard({ session, layout = 'grid', note }: { session: Session; layout?: 'grid' | 'list' | 'rail'; note?: string }) {
  const { userData, toggleFavourite, seriesDefs } = useStillflow()
  const name = shortTitle(session, seriesDefs)
  const gone = isUnavailable(session)
  const fav = !!userData[session.id]?.favourite
  const rating = userData[session.id]?.rating
  const focus = session.physicalFocus[0]
  return (
    <article className={cx(styles.card, styles[layout])}>
      <a href={hrefOf({ name: 'session', id: session.id })} className={styles.link}>
        <Thumb session={session} className={styles.thumb} />
        <div className={styles.body}>
          {name.label && <span className={styles.series}>{name.label}</span>}
          <h3 className={styles.title} title={name.title !== session.title ? session.title : undefined}>{name.title}</h3>
          {gone && <span className={styles.gone}>No longer on YouTube</span>}
          <div className={styles.meta}>
            {session.styles.length > 0 && <span>{session.styles.slice(0, layout === 'list' ? 2 : 1).join(' · ')}</span>}
            {focus && <span>{focus}</span>}
            {layout === 'list' && <span className={styles.minutes}>{session.durationMinutes} min</span>}
            {session.publishedDate && <span className={styles.posted} title={`Posted ${formatDay(session.publishedDate)}`}>{formatMonth(session.publishedDate)}</span>}
            {rating ? <span className={styles.again}>{repeatLabel(rating)}</span> : null}
          </div>
          {/* Only what's known: an unset intensity fills in once you practise it and say how it felt. */}
          {session.intensity > 0 && <IntensityDots level={session.intensity} />}
          {note && <p className={styles.note}>{note}</p>}
        </div>
      </a>
      <button type="button" className={cx(styles.fav, fav && styles.favOn)} aria-pressed={fav}
        aria-label={fav ? `Remove ${session.title} from favourites` : `Add ${session.title} to favourites`}
        onClick={() => toggleFavourite(session.id)}>
        <Heart size={18} strokeWidth={1.6} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
