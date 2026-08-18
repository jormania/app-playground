import { Button } from '../../ds'
import { fadeRatio, daysRemaining, DEFAULT_SEASON_DAYS } from '../lib/understory'
import type { Thing } from '../lib/notion'
import styles from './UnderstoryView.module.css'

export interface UnderstoryViewProps {
  things: Thing[]
  onKeep: (id: string) => void
  onRelease: (id: string) => void
  seasonDays?: number
}

/** Unkept arrivals, each shown with its remaining season as a fade rather
 *  than a countdown number (SILVA.md: "the understory... with their
 *  remaining season shown as a fade rather than a number"). */
export function UnderstoryView({ things, onKeep, onRelease, seasonDays = DEFAULT_SEASON_DAYS }: UnderstoryViewProps) {
  if (things.length === 0) {
    return <p className={styles.empty}>The understory is empty. Type or paste something to begin.</p>
  }

  return (
    <ul className={styles.list}>
      {things.map((thing) => {
        const fade = fadeRatio(thing, seasonDays)
        const remaining = Math.max(0, Math.ceil(daysRemaining(thing, seasonDays)))
        return (
          <li
            key={thing.id}
            className={styles.row}
            style={{ opacity: 0.4 + fade * 0.6 }}
          >
            <div className={styles.body}>
              {thing.kind && <span className={styles.kind}>{thing.kind}</span>}
              <p className={styles.text}>{thing.body}</p>
              <p className={styles.meta}>
                {remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'} left` : 'fading'}
              </p>
            </div>
            <div className={styles.actions}>
              <Button size="sm" variant="primary" onClick={() => onKeep(thing.id)}>
                Keep
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRelease(thing.id)}>
                Release
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
