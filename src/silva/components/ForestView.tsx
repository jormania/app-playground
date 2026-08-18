import { useMemo } from 'react'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import styles from './ForestView.module.css'

export interface ForestViewProps {
  things: Thing[]
  sources: Source[]
}

/** The kept collection, read one thing at a time — typeset to be read, not a
 *  row in a table (SILVA.md: "Scroll is a walk, not a list"). Sorted by most
 *  recently kept; ordering by affinity (loci, mycorrhiza) is a later session. */
export function ForestView({ things, sources }: ForestViewProps) {
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])

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
      {kept.map((thing) => {
        const sourceTitle = thing.sourceId ? sourceById.get(thing.sourceId)?.title : undefined
        return (
          <article key={thing.id} className={styles.plate}>
            {thing.kind && <p className={styles.kind}>{thing.kind}</p>}
            <p className={styles.body}>{thing.body}</p>
            {thing.note && <p className={styles.note}>{thing.note}</p>}
            <ThingLabel thing={thing} sourceTitle={sourceTitle} />
          </article>
        )
      })}
    </div>
  )
}

/** Specimen-label order per SILVA.md: source · locator · encountered · kept.
 *  Source/locator read fine unlabelled (a title, a page reference); the two
 *  dates don't — "2025-10-05 · 2026-08-18" doesn't say which is which — so
 *  those get an explicit, low-key field word (a colour shift, not a pill:
 *  the herbarium label is engraved text, not a chip). Collapsed to one date
 *  when they're the same day, the common case for a thing kept straight
 *  from a fresh note. */
function ThingLabel({ thing, sourceTitle }: { thing: Thing; sourceTitle?: string }) {
  const values = [sourceTitle, thing.locator].filter(Boolean) as string[]
  const dated = thing.kept && thing.kept !== thing.encountered
    ? [{ field: 'encountered', value: thing.encountered }, { field: 'kept', value: thing.kept }]
    : [{ field: 'kept', value: thing.kept ?? thing.encountered }]

  return (
    <p className={styles.label}>
      {values.map((value, i) => (
        <span key={value}>
          {i > 0 && <span className={styles.labelSep}> · </span>}
          {value}
        </span>
      ))}
      {dated.map((d, i) => (
        <span key={d.field}>
          {(values.length > 0 || i > 0) && <span className={styles.labelSep}> · </span>}
          <span className={styles.labelField}>{d.field}</span> {d.value}
        </span>
      ))}
    </p>
  )
}
