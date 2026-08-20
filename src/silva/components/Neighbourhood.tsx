import { useMemo, useState } from 'react'
import { Button, TextAreaField } from '../../ds'
import type { Thing } from '../lib/notion'
import type { Path } from '../lib/paths'
import { computeNeighbourhood, layoutEgoGraph, egoViewBox } from '../lib/neighbourhood'
import styles from './Neighbourhood.module.css'

export interface NeighbourhoodProps {
  thing: Thing
  things: Thing[]
  paths: Path[]
  vectorsById: Map<string, Float32Array>
  onMakePath: (fromId: string, toId: string, why: string) => void
  /** Settings' "Show the graph" — on by default. Off hides only the small
   *  node-link drawing below; the toggle, counts, and both list groups
   *  ("Paths you walked", "Grew near this", "Walk a path") stay exactly as
   *  they are. This is the same picture as the crossing and the rootstock,
   *  just of one thing instead of the whole forest — so the setting that
   *  turns those off turns this off too, while the *functionality* of
   *  making a path from here is untouched (SILVA.md: "the make-a-path
   *  form... [is] unaffected either way" by this setting). */
  showGraph?: boolean
}

function summarize(thing: Thing, max = 110): string {
  const text = thing.body || thing.handle
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * What this thing is near — the underground layer, delivered at the moment it
 * is useful rather than as a separate map you have to go and consult.
 *
 * Two kinds of connection, held strictly apart, because the distinction is the
 * heart of SILVA.md: **paths** are yours and carry the why you wrote;
 * **mycorrhiza** is latent, oxblood, and never a connection until you say it
 * is. So a near thing is offered with one route onward — write why — and the
 * conversion from fiber to path is the human act the spec insists on.
 *
 * Collapsed by default. The plate's job is to be read; this waits under it
 * until asked.
 */
export function Neighbourhood({ thing, things, paths, vectorsById, onMakePath, showGraph = true }: NeighbourhoodProps) {
  const [open, setOpen] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [why, setWhy] = useState('')

  /**
   * Memoised, and that is not a micro-optimisation — it is the difference
   * between a forest that scales and one that does not.
   *
   * `computeNeighbourhood` scans every kept thing and takes a cosine
   * similarity against each one. The Forest renders one of these panels per
   * kept thing, so running it unmemoised in the component body made the
   * whole scroll **O(n²) similarities on every single render** — 10,000
   * at a hundred things, a million at a thousand, each over a 384-dimension
   * vector, all of it recomputed when anything at all in App's state
   * changed, and all of it thrown away because the panel is collapsed.
   *
   * It cannot simply be skipped while collapsed: the toggle shows the two
   * counts, so the numbers have to exist before it opens. Memoising is what
   * makes that affordable — the work now happens once per data change
   * rather than once per render. (The other half of the fix is that the
   * Forest only mounts a window of plates at a time; see ForestView.)
   */
  const neighbourhood = useMemo(
    () => computeNeighbourhood(thing, things, vectorsById, paths),
    [thing, things, vectorsById, paths],
  )
  const { near, connected } = neighbourhood

  const nodes = useMemo(() => layoutEgoGraph(neighbourhood), [neighbourhood])
  const box = useMemo(() => egoViewBox(nodes), [nodes])

  // After the hooks, never before: an early return above a `useMemo` changes
  // the hook order between renders, which React forbids outright.
  if (near.length === 0 && connected.length === 0) return null
  const self = nodes[0]

  function startResponding(id: string) {
    setRespondingTo(id)
    setWhy('')
  }

  return (
    <section className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className={styles.toggleLabel}>Near this</span>
        <span className={styles.counts}>
          {connected.length > 0 && (
            <span className={styles.countPath}>{connected.length} path{connected.length === 1 ? '' : 's'}</span>
          )}
          {near.length > 0 && (
            <span className={styles.countNear}>{near.length} unspoken</span>
          )}
        </span>
      </button>

      {open && (
        <div className={styles.panel}>
          {/* Centre plus one ring — the whole layout. There is nothing to
           *  simulate when the neighbourhood is bounded by construction, which
           *  is exactly why this scales where the global graph does not.
           *  Gated on `showGraph` alone — this is the same picture as the
           *  crossing and the rootstock, just of one thing rather than the
           *  whole forest, so the setting that hides those hides this too.
           *  Everything below it (the lists, "Walk a path") is the
           *  make-a-path form, not the drawing, and stays regardless. */}
          {showGraph && (
            <svg
              className={styles.graph}
              viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
              role="img"
              aria-label={`This thing, with ${connected.length} path${connected.length === 1 ? '' : 's'} and ${near.length} unspoken thread${near.length === 1 ? '' : 's'}`}
            >
              {nodes.slice(1).map((node) => (
                <line
                  key={`edge-${node.id}`}
                  x1={self.x} y1={self.y} x2={node.x} y2={node.y}
                  className={node.role === 'connected' ? styles.edgePath : styles.edgeNear}
                />
              ))}
              {nodes.map((node) => (
                <circle
                  key={node.id}
                  cx={node.x} cy={node.y}
                  r={node.role === 'self' ? 7 : 5}
                  className={
                    node.role === 'self' ? styles.nodeSelf
                      : node.role === 'connected' ? styles.nodePath
                        : styles.nodeNear
                  }
                />
              ))}
            </svg>
          )}

          {connected.length > 0 && (
            <div className={styles.group}>
              <h4 className={styles.groupTitle}>Paths you walked</h4>
              <ul className={styles.list}>
                {connected.map(({ thing: other, path }) => (
                  <li key={path.id} className={styles.row}>
                    <p className={styles.rowBody}>{summarize(other)}</p>
                    <p className={styles.rowWhy}>{path.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {near.length > 0 && (
            <div className={styles.group}>
              <h4 className={styles.groupTitleNear}>Grew near this</h4>
              {/* Never states what the connection is — SILVA.md: the model may
               *  propose adjacency, only you may assert meaning. */}
              <p className={styles.groupHint}>
                Noticed, not asserted. Say what you see and it becomes a path.
              </p>
              <ul className={styles.list}>
                {near.map(({ thing: other }) => (
                  <li key={other.id} className={styles.row}>
                    <p className={styles.rowBody}>{summarize(other)}</p>
                    {respondingTo === other.id ? (
                      <div className={styles.respond}>
                        <TextAreaField
                          label="What did you see between them?"
                          value={why}
                          onChange={(e) => setWhy(e.target.value)}
                          rows={2}
                        />
                        <div className={styles.respondActions}>
                          <Button size="sm" variant="ghost" onClick={() => setRespondingTo(null)}>Back</Button>
                          <Button
                            size="sm"
                            disabled={!why.trim()}
                            onClick={() => {
                              onMakePath(thing.id, other.id, why.trim())
                              setRespondingTo(null)
                            }}
                          >
                            Walk this path
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => startResponding(other.id)}>
                        Walk a path
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
