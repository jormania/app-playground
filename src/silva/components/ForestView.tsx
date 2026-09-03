import { useMemo } from 'react'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import type { Locus } from '../lib/loci'
import type { Path } from '../lib/paths'
import type { SeenMap } from '../lib/seen'
import { SpecimenPlate } from './SpecimenPlate'
import { Neighbourhood } from './Neighbourhood'
import { TodaysWalk } from './TodaysWalk'
import { useProgressiveList } from './useProgressiveList'
import styles from './ForestView.module.css'

export interface ForestViewProps {
  things: Thing[]
  sources: Source[]
  loci: Locus[]
  paths: Path[]
  vectorsById: Map<string, Float32Array>
  seen: SeenMap
  onEdit: (id: string, patch: Partial<Thing>, sourceInput?: string) => void
  onRelease: (id: string) => void
  onDelete: (id: string) => void
  /** Plants a passage taken out of a link's own page as a thing of its own
   *  (App.tsx's `handleCutting`). Passed straight through to the plate. */
  onCutting?: (thing: Thing, body: string) => void
  onSeen: (id: string) => void
  onMakePath: (fromId: string, toId: string, why: string) => void
  /** Settings' "Show the walk" — on by default. Off just means the Forest is
   *  the scroll alone, for anyone who'd rather nothing above it claim their
   *  attention first. */
  showWalk?: boolean
  /** Settings' "Show the graph" — on by default. Off hides the crossing in
   *  Underground *and* the small node-link drawing inside a plate's own
   *  Neighbourhood panel: both are the same kind of picture, so turning off
   *  "the graph" turns off graphs, full stop. The rest of Neighbourhood
   *  (the "Near this" toggle, the path lists, "Walk a path") is untouched —
   *  that's the make-a-path form, not the drawing, and SILVA.md is explicit
   *  paths themselves are unaffected by this setting either way. */
  showGraph?: boolean
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
  onRelease,
  onDelete,
  onCutting,
  onSeen,
  onMakePath,
  showWalk = true,
  showGraph = true,
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
        onRelease={onRelease}
        onDelete={onDelete}
        onCutting={onCutting}
        onSeen={onSeen}
        allSources={sources}
      >
        <Neighbourhood
          thing={thing}
          things={things}
          paths={paths}
          vectorsById={vectorsById}
          onMakePath={onMakePath}
          showGraph={showGraph}
        />
      </SpecimenPlate>
    )
  }

  // Only the DOM is paged; `kept` itself stays whole for everything else.
  const { visible, hasMore, sentinelRef } = useProgressiveList(kept)

  if (kept.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing kept yet. Things you keep from the nursery gather here.
      </p>
    )
  }

  return (
    <div className={styles.forest}>
      {showWalk && <TodaysWalk things={things} seen={seen} renderThing={renderThing} vectorsById={vectorsById} />}
      {visible.map((thing) => <div key={thing.id}>{renderThing(thing)}</div>)}
      {/* The scroll grows as it is walked. Nothing is hidden from the app —
       *  the walk, Forage, the crossing and every provocation still see the
       *  whole collection; only the DOM is paged, because a plate is an
       *  expensive thing to mount and there is no reason to mount one for a
       *  passage ten thousand pixels below the fold. See useProgressiveList. */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className={styles.sentinel} />}
    </div>
  )
}
