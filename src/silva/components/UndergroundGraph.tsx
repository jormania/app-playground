import { useEffect, useState } from 'react'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import type { Path } from '../lib/paths'
import { computeGraphLayout, pathsToEdges, computeMycorrhiza, computeViewBox } from '../lib/graph'
import { peekVectors } from '../lib/vectorCache'
import styles from './UndergroundGraph.module.css'

export interface UndergroundGraphProps {
  things: Thing[]
  loci: Locus[]
  paths: Path[]
}

/** The Underground graph — solid Path edges, faint unclickable mycorrhiza
 *  fibers (SILVA.md: "unclickable until offered as a provocation" — the
 *  only way to act on one is still the existing Provocation flow), nodes
 *  clustered by locus. Static layout, click a node to see it in full. */
export function UndergroundGraph({ things, loci, paths }: UndergroundGraphProps) {
  const [vectorsById, setVectorsById] = useState<Map<string, Float32Array>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const kept = things.filter((t) => t.state === 'Kept')
    peekVectors(kept).then((vectors) => {
      if (!cancelled) setVectorsById(vectors)
    })
    return () => {
      cancelled = true
    }
  }, [things])

  const layout = computeGraphLayout(things, loci)
  const edges = pathsToEdges(paths)
  const fibers = computeMycorrhiza(things, vectorsById, paths)
  const positionById = new Map(layout.nodes.map((n) => [n.thing.id, n]))

  const selectedThing = selectedId ? things.find((t) => t.id === selectedId) : null
  const highlightedIds = new Set<string>()
  if (selectedId) {
    highlightedIds.add(selectedId)
    for (const e of edges) {
      if (e.fromId === selectedId) highlightedIds.add(e.toId)
      if (e.toId === selectedId) highlightedIds.add(e.fromId)
    }
  }

  if (layout.nodes.length === 0) {
    return (
      <div className={styles.wrap}>
        <h3 className={styles.heading}>The graph</h3>
        <p className={styles.empty}>Nothing kept yet — the graph fills in as you keep things.</p>
      </div>
    )
  }

  const viewBox = computeViewBox(layout)

  return (
    <div className={styles.wrap}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>The graph</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <svg width="28" height="8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" className={styles.legendEdge} /></svg>
            path you walked
          </span>
          <span className={styles.legendItem}>
            <svg width="28" height="8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" className={styles.legendMycorrhiza} /></svg>
            unspoken thread
          </span>
        </div>
      </div>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className={styles.svg}
        role="img"
        aria-label="A graph of kept things, clustered by clearing, connected by paths"
      >
        {layout.clusters.length > 1 && layout.clusters.map((c) => (
          <text key={c.id} x={c.x} y={c.y - 70} className={styles.clusterLabel} textAnchor="middle">
            {c.label}
          </text>
        ))}

        {fibers.map((f) => {
          const a = positionById.get(f.aId)
          const b = positionById.get(f.bId)
          if (!a || !b) return null
          return (
            <line
              key={`${f.aId}-${f.bId}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={styles.mycorrhiza}
              pointerEvents="none"
            />
          )
        })}

        {edges.map((e) => {
          const a = positionById.get(e.fromId)
          const b = positionById.get(e.toId)
          if (!a || !b) return null
          const dim = selectedId && !highlightedIds.has(e.fromId)
          return (
            <line
              key={`${e.fromId}-${e.toId}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={dim ? styles.edgeDim : styles.edge}
            />
          )
        })}

        {layout.nodes.map((node) => {
          const isSelected = node.thing.id === selectedId
          const isHighlighted = highlightedIds.has(node.thing.id)
          const dim = selectedId && !isHighlighted
          return (
            <circle
              key={node.thing.id}
              cx={node.x}
              cy={node.y}
              r={isSelected ? 10 : 8}
              className={dim ? styles.nodeDim : isSelected ? styles.nodeSelected : styles.node}
              onClick={() => setSelectedId(isSelected ? null : node.thing.id)}
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
