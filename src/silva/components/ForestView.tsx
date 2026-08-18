import type { Thing } from '../lib/notion'
import styles from './ForestView.module.css'

export interface ForestViewProps {
  things: Thing[]
}

/** The kept collection, read one thing at a time — typeset to be read, not a
 *  row in a table (SILVA.md: "Scroll is a walk, not a list"). Sorted by most
 *  recently kept; ordering by affinity (loci, mycorrhiza) is a later session. */
export function ForestView({ things }: ForestViewProps) {
  const kept = [...things]
    .filter((thing) => thing.state === 'Kept')
    .sort((a, b) => (b.kept || '').localeCompare(a.kept || ''))

  if (kept.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing kept yet. Things you keep from the understory gather here.
      </p>
    )
  }

  return (
    <div className={styles.forest}>
      {kept.map((thing) => (
        <article key={thing.id} className={styles.plate}>
          {thing.kind && <p className={styles.kind}>{thing.kind}</p>}
          <p className={styles.body}>{thing.body}</p>
          {thing.note && <p className={styles.note}>{thing.note}</p>}
          <p className={styles.label}>
            {[thing.locator, thing.encountered].filter(Boolean).join(' · ')}
          </p>
        </article>
      ))}
    </div>
  )
}
