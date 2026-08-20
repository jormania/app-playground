import { useEffect, useMemo, useRef, useState } from 'react'
import type { Thing } from '../lib/notion'
import type { Locus } from '../lib/loci'
import type { Path } from '../lib/paths'
import {
  computeGraphLayout,
  pathsToEdges,
  computeMycorrhiza,
  computeViewBox,
  clusterLabelY, clusterLabelText,
} from '../lib/graph'
import styles from './graphs.module.css'

export interface UndergroundGraphProps {
  things: Thing[]
  loci: Locus[]
  paths: Path[]
  /** Peeked/indexed by App — the graph never loads the model itself, so an
   *  empty map simply means no mycorrhiza is drawn (see lib/indexer.ts). */
  vectorsById: Map<string, Float32Array>
}

/** The Underground graph — solid Path edges, faint unclickable mycorrhiza
 *  fibers (SILVA.md: "unclickable until offered as a provocation" — the
 *  only way to act on one is still the existing Provocation flow), nodes
 *  clustered by locus. Static layout, click a node to see it in full. */
export function UndergroundGraph({ things, loci, paths, vectorsById }: UndergroundGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // SILVA.md allows exactly two motions in the app, and this is the second:
  // "the drawing of a path when you accept a provocation." An edge that wasn't
  // in the previous render draws itself; every edge already on screen is
  // simply there, so opening the view never animates the whole graph.
  const seenEdges = useRef<Set<string> | null>(null)
  const [freshEdges, setFreshEdges] = useState<Set<string>>(new Set())

  const layout = useMemo(() => computeGraphLayout(things, loci), [things, loci])
  const edges = useMemo(() => pathsToEdges(paths), [paths])
  // O(n^2) over kept things — cheap at personal scale, but not something to
  // recompute on every unrelated render (selecting a node, for one).
  const fibers = useMemo(() => computeMycorrhiza(things, vectorsById, paths), [things, vectorsById, paths])
  const positionById = new Map(layout.nodes.map((n) => [n.thing.id, n]))
  const edgeKeys = useMemo(() => edges.map((e) => `${e.fromId}-${e.toId}`), [edges])

  useEffect(() => {
    const current = new Set(edgeKeys)
    // First render establishes the baseline: nothing is "new" on arrival.
    if (seenEdges.current === null) {
      seenEdges.current = current
      return
    }
    const previous = seenEdges.current
    const added = edgeKeys.filter((key) => !previous.has(key))
    seenEdges.current = current
    if (added.length > 0) setFreshEdges(new Set(added))
  }, [edgeKeys])

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
        <h3 className={styles.heading}>The crossing</h3>
        <p className={styles.empty}>Nothing kept yet — the crossing fills in as you keep things.</p>
      </div>
    )
  }

  const viewBox = computeViewBox(layout)

  return (
    <div className={styles.wrap}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>The crossing</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <svg width="28" height="8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" className={styles.legendEdge} /></svg>
            path you walked
          </span>
          {/* Only when there is actually one to see. Mycorrhiza needs the
           *  embedding model, which is opt-in ("Let Silva notice things" in
           *  the Hearth, a ~25 MB download) — so with it off, this key
           *  described a line the drawing never contained, which is worse
           *  than no key at all. */}
          {fibers.length > 0 && (
            <span className={styles.legendItem}>
              <svg width="28" height="8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" className={styles.legendMycorrhiza} /></svg>
              unspoken thread
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className={styles.svg}
        // `role="img"` told assistive tech the contents were a single
        // decorative picture, while the nodes inside are real controls —
        // some screen readers resolve that by skipping them entirely. A
        // group keeps the summary label without contradicting its children.
        role="group"
        aria-label="The crossing — kept things clustered by clearing, connected by the paths you have walked"
      >
        {layout.clusters.length > 1 && layout.clusters.map((c) => (
          <text key={c.id} x={c.x} y={clusterLabelY(c)} className={styles.clusterLabel} textAnchor="middle">
            {clusterLabelText(c)}
            {/* Only when the caption was actually elided — otherwise this is
              * the same string twice, and SVG <title> is what a reader
              * hovers to recover the full name. */}
            {clusterLabelText(c) !== c.label && <title>{c.label}</title>}
          </text>
        ))}

        {fibers.map((f, index) => {
          const a = positionById.get(f.aId)
          const b = positionById.get(f.bId)
          if (!a || !b) return null
          // SILVA.md: mycorrhiza is "only visible while you hold the view
          // open, faint" — so fibers surface slowly rather than being there
          // the instant the graph paints, staggered a little so the
          // underground reads as something emerging, not a layer toggling.
          return (
            <line
              key={`${f.aId}-${f.bId}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={styles.mycorrhiza}
              pointerEvents="none"
              style={{ animationDelay: `${Math.min(index * 60, 900)}ms` }}
            />
          )
        })}

        {edges.map((e) => {
          const a = positionById.get(e.fromId)
          const b = positionById.get(e.toId)
          if (!a || !b) return null
          // Lit only when the edge actually *touches* the selection — testing
          // one end alone left an unrelated edge undimmed whenever its `from`
          // happened to be a neighbour of the selected node.
          const dim = selectedId !== null && e.fromId !== selectedId && e.toId !== selectedId
          const key = `${e.fromId}-${e.toId}`
          const drawing = freshEdges.has(key)
          const length = Math.hypot(b.x - a.x, b.y - a.y)
          return (
            <line
              key={key}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={`${dim ? styles.edgeDim : styles.edge} ${drawing ? styles.edgeDrawing : ''}`}
              style={drawing ? { strokeDasharray: length, strokeDashoffset: length } : undefined}
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
              // A bare <circle onClick> cannot be reached without a mouse.
              // These four make each node a real button in the tab order, so
              // the graph can be read end to end from the keyboard.
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
