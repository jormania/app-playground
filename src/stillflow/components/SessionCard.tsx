import { Heart } from 'lucide-react'
import type { Session } from '../domain/types'
import { repeatLabel } from '../domain/vocabulary'
import { hrefOf } from '../app/router'
import { useStillflow } from '../app/state'
import { cx } from '../../ds/lib/cx'
import { IntensityDots, Thumb } from './ui'
import styles from './SessionCard.module.css'

export function SessionCard({ session, layout = 'grid', note }: { session: Session; layout?: 'grid' | 'list' | 'rail'; note?: string }) {
  const { userData, toggleFavourite } = useStillflow()
  const fav = !!userData[session.id]?.favourite
  const rating = userData[session.id]?.rating
  const focus = session.physicalFocus[0]
  return (
    <article className={cx(styles.card, styles[layout])}>
      <a href={hrefOf({ name: 'session', id: session.id })} className={styles.link}>
        <Thumb session={session} className={styles.thumb} />
        <div className={styles.body}>
          {session.series && <span className={styles.series}>{session.series}</span>}
          <h3 className={styles.title}>{session.title}</h3>
          <div className={styles.meta}>
            <span>{session.styles.slice(0, layout === 'list' ? 2 : 1).join(' · ') || 'Style not set'}</span>
            {focus && <span>{focus}</span>}
            {layout === 'list' && <span className={styles.minutes}>{session.durationMinutes} min</span>}
            {rating ? <span className={styles.again}>{repeatLabel(rating)}</span> : null}
          </div>
          <IntensityDots level={session.intensity} />
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
