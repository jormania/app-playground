import { useMemo } from 'react'
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
  onEdit: (id: string, patch: Partial<Thing>, sourceInput?: string) => void
  onSeen: (id: string) => void
  onMakePath: (fromId: string, toId: string, why: string) => void
  /** Settings' "Show the walk" — on by default. Off just means the Forest is
   *  the scroll alone, for anyone who'd rather nothing above it claim their
   *  attention first. */
  showWalk?: boolean
}

/** The kept collection. The walk sits at the head — a short, finite,
 *  once-a-day stretch weighted by what you haven't looked at (SILVA.md:
 *  "Scroll is a walk, not a list") — with the full forest below it,
 *  unchanged: every kept thing, one at a time, in the order you kept them.
 *
 *  This used to also carry a "Show" dropdown narrowing that scroll to one
 *  clearing — cut rather than kept, because it duplicated ClearingsView's
 *  own locus detail screen (which already lists a clearing's members, with
 *  the clearing's own name and meaning at the top — strictly more context
 *  than a flat filtered list here could offer) and it worked against the
 *  very rule that names this component: a filterable index is a library
 *  move, and the Forest's whole reason for existing is not to be one. */
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

  const kept = useMemo(
    () => [...things]
      .filter((thing) => thing.state === 'Kept')
      .sort((a, b) => (b.kept || '').localeCompare(a.kept || '')),
    [things],
  )

  // One plate, however it's reached — so the walk and the scroll are provably
  // the same reading surface, including dwell tracking and the neighbourhood.
  function renderThing(thing: Thing) {
    return (
      <SpecimenPlate
        thing={thing}
        source={thing.sourceId ? sourceById.get(thing.sourceId) : undefined}
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
      {kept.map((thing) => <div key={thing.id}>{renderThing(thing)}</div>)}
    </div>
  )
}
