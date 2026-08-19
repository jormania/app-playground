import { useMemo, useState } from 'react'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import type { Locus } from '../lib/loci'
import type { Path } from '../lib/paths'
import type { SeenMap } from '../lib/seen'
import { SpecimenPlate } from './SpecimenPlate'
import { Neighbourhood } from './Neighbourhood'
import { TodaysWalk } from './TodaysWalk'
import styles from './ForestView.module.css'

export interface ForestViewProps {
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  paths: Path[]
  vectorsById: Map<string, Float32Array>
  seen: SeenMap
  onEdit: (id: string, patch: Partial<Thing>) => void
  onSeen: (id: string) => void
  onMakePath: (fromId: string, toId: string, why: string) => void
  /** Settings' "Show the walk" — on by default. Off just means the Forest is
   *  the scroll alone, for anyone who'd rather nothing above it claim their
   *  attention first. */
  showWalk?: boolean
}

/** The kept collection. Today's walk sits at the head — a short, finite stretch
 *  weighted by what you haven't looked at (SILVA.md: "Scroll is a walk, not a
 *  list") — with the full forest below it, unchanged, for when you want to
 *  browse rather than be shown. */
export function ForestView({
  things,
  sources,
  loci,
  paths,
  vectorsById,
  seen,
  onEdit,
  onSeen,
  onMakePath,
  showWalk = true,
}: ForestViewProps) {
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const locusById = useMemo(() => new Map(loci.map((l) => [l.id, l])), [loci])
  // A walk through the forest, not a query over it — so the only control here
  // is which stretch of it you're walking, never a search box (that's Search,
  // and SILVA.md is explicit that it isn't the point).
  const [clearing, setClearing] = useState<string>('all')

  const kept = useMemo(
    () => [...things]
      .filter((thing) => thing.state === 'Kept')
      .sort((a, b) => (b.kept || '').localeCompare(a.kept || '')),
    [things],
  )

  const walked = useMemo(() => {
    if (clearing === 'all') return kept
    if (clearing === 'none') return kept.filter((t) => t.lociIds.length === 0)
    return kept.filter((t) => t.lociIds.includes(clearing))
  }, [kept, clearing])

  // One plate, however it's reached — so the walk and the scroll are provably
  // the same reading surface, including dwell tracking and the neighbourhood.
  function renderThing(thing: Thing) {
    return (
      <SpecimenPlate
        thing={thing}
        sourceTitle={thing.sourceId ? sourceById.get(thing.sourceId)?.title : undefined}
        locusNames={thing.lociIds.map((id) => locusById.get(id)?.name).filter((n): n is string => Boolean(n))}
        onEdit={onEdit}
        onSeen={onSeen}
      >
        <Neighbourhood
          thing={thing}
          things={things}
          paths={paths}
          vectorsById={vectorsById}
          onMakePath={onMakePath}
        />
      </SpecimenPlate>
    )
  }

  if (kept.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing kept yet. Things you keep from the understory gather here.
      </p>
    )
  }

  return (
    <div className={styles.forest}>
      {showWalk && <TodaysWalk things={things} seen={seen} renderThing={renderThing} />}

      {loci.length > 0 && (
        <div className={styles.walkRow}>
          <label className={styles.walkLabel} htmlFor="silva-forest-walk">Walk</label>
          <select
            id="silva-forest-walk"
            className={styles.walkSelect}
            value={clearing}
            onChange={(e) => setClearing(e.target.value)}
          >
            <option value="all">the whole forest</option>
            <option value="none">what's in no clearing</option>
            {loci.map((locus) => <option key={locus.id} value={locus.id}>{locus.name}</option>)}
          </select>
          <span className={styles.walkCount}>
            {walked.length} of {kept.length}
          </span>
        </div>
      )}

      {walked.length === 0 ? (
        <p className={styles.empty}>Nothing along this stretch.</p>
      ) : (
        walked.map((thing) => <div key={thing.id}>{renderThing(thing)}</div>)
      )}
    </div>
  )
}
