import { useMemo, useState } from 'react'
import type { Thing } from '../lib/notion'
import type { Source } from '../lib/sources'
import { computeRootstockLayout, computeViewBox, clusterLabelY, clusterLabelText, clusterLabelFontSize } from '../lib/graph'
import styles from './graphs.module.css'

export interface RootstockGraphProps {
  things: Thing[]
  sources: Source[]
}

/**
 * The rootstock — every kept thing gathered under the source it grew from.
 *
 * Deliberately the crossing's twin rather than its own idea: same ring
 * layout (`lib/graph.ts`'s shared `ringLayout`), same stylesheet, same
 * selection behaviour, same keyboard-reachable nodes. What differs is the
 * grouping and the one line type — the crossing draws edges *between*
 * things you connected, this draws each thing back to where it came from.
 * Put side by side they should read as two views of one forest, which is
 * the whole reason they share their layout code and their CSS.
 *
 * Cheaper than the crossing by construction: no embeddings, no mycorrhiza,
 * no O(n²) similarity pass — a thing has exactly one source, so this is a
 * true partition and nothing here has to be computed against anything else.
 */
export function RootstockGraph({ things, sources }: RootstockGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const layout = useMemo(() => computeRootstockLayout(things, sources), [things, sources])
  const clusterById = useMemo(
    () => new Map(layout.clusters.map((c) => [c.id, c])),
    [layout],
  )

  // Nothing to draw renders nothing at all — unlike the crossing, which does
  // show an empty state. The difference is what sits underneath: Roots' own
  // list already says "nothing kept has a source yet" in the same breath, and
  // an empty drawing above it would put that sentence on screen twice.
  if (layout.nodes.length === 0) return null

  const viewBox = computeViewBox(layout)
  const selectedThing = selectedId ? things.find((t) => t.id === selectedId) : null
  // Everything under the same root as the selection stays lit — the question
  // this drawing answers is "what else came from here", so selecting one
  // thing should show you its siblings, not isolate it.
  const selectedCluster = selectedId
    ? layout.nodes.find((n) => n.thing.id === selectedId)?.clusterId ?? null
    : null

  return (
    <div className={styles.wrap}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>The rootstock</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <svg width="28" height="8" aria-hidden="true">
              <circle cx="6" cy="4" r="3" className={styles.hub} />
              <line x1="10" y1="4" x2="27" y2="4" className={styles.spoke} />
            </svg>
            what grew from a source
          </span>
        </div>
      </div>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className={styles.svg}
        // A group, not an img — the nodes inside are real controls, and
        // `role="img"` makes some screen readers skip them (see
        // UndergroundGraph.tsx for the same note).
        role="group"
        aria-label="The rootstock — kept things gathered under the source each came from"
      >
        {layout.clusters.length > 1 && layout.clusters.map((c) => (
          <text key={c.id} x={c.x} y={clusterLabelY(c)} className={styles.clusterLabel} textAnchor="middle" fontSize={clusterLabelFontSize(viewBox.width)}>
            {clusterLabelText(c)}
            {/* Only when the caption was actually elided — otherwise this is
              * the same string twice, and SVG <title> is what a reader
              * hovers to recover the full name. */}
            {clusterLabelText(c) !== c.label && <title>{c.label}</title>}
          </text>
        ))}

        {/* Spokes first, so a node always sits on top of its own line. */}
        {layout.nodes.map((node) => {
          const hub = clusterById.get(node.clusterId)
          if (!hub) return null
          const dim = selectedCluster !== null && node.clusterId !== selectedCluster
          return (
            <line
              key={`spoke-${node.thing.id}`}
              x1={hub.x} y1={hub.y} x2={node.x} y2={node.y}
              className={dim ? styles.spokeDim : styles.spoke}
              pointerEvents="none"
            />
          )
        })}

        {layout.clusters.map((c) => (
          <circle key={`hub-${c.id}`} cx={c.x} cy={c.y} r={5} className={styles.hub} pointerEvents="none" />
        ))}

        {layout.nodes.map((node) => {
          const isSelected = node.thing.id === selectedId
          const dim = selectedCluster !== null && node.clusterId !== selectedCluster
          return (
            <circle
              key={node.thing.id}
              cx={node.x}
              cy={node.y}
              r={isSelected ? 10 : 8}
              className={dim ? styles.nodeDim : isSelected ? styles.nodeSelected : styles.node}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={node.thing.handle || node.thing.body.slice(0, 60)}
              onClick={() => setSelectedId(isSelected ? null : node.thing.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedId(isSelected ? null : node.thing.id)
                }
              }}
            >
              <title>{node.thing.handle || node.thing.body}</title>
            </circle>
          )
        })}
      </svg>

      {selectedThing && (
        <div className={styles.panel}>
          {selectedThing.kind && <p className={styles.panelKind}>{selectedThing.kind}</p>}
          <p className={styles.panelBody}>{selectedThing.body}</p>
        </div>
      )}
    </div>
  )
}
