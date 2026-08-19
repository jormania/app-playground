/**
 * What one thing is near.
 *
 * The Underground view draws the whole forest as a node-link graph, on a
 * hand-rolled ring layout that the code itself flags as pre-physics. It does
 * not scale: a clearing with sixty members puts sixty nodes on a 90-unit
 * radius, about nine pixels of arc between eight-pixel dots. It doesn't
 * degrade — it becomes a solid ring and stops being a graph.
 *
 * The cheaper answer is to notice that nobody asks "what is the topology of my
 * commonplace book". The question people actually have is *"what is this
 * near?"*, and they have it while looking at a particular thing. So this
 * computes one thing's neighbourhood instead of the whole map — which needs no
 * layout algorithm at all, because **n is small by construction** and stays
 * small forever, no matter how large the forest grows.
 *
 * Both halves of SILVA.md's connection model are represented, and kept
 * strictly apart:
 *
 * - **Paths** are connections *you* made, carrying your own `why`. Asserted.
 * - **Mycorrhiza** is latent affinity the embeddings noticed. Never presented
 *   as fact, never auto-applied. A fiber becomes a path only through a human
 *   act — which is why `near` here is a proposal with a one-tap route to
 *   writing the why, and never a connection in its own right.
 */

import type { Thing } from './notion'
import type { Path } from './paths'
import { cosineSimilarity } from './embeddings'
import { MYCORRHIZA_THRESHOLD } from './graph'

/** Enough to be worth reading, few enough to stay a neighbourhood rather than
 *  becoming the search results it must not turn into. */
export const NEIGHBOURHOOD_LIMIT = 4

export interface NearThing {
  thing: Thing
  similarity: number
}

export interface ConnectedThing {
  thing: Thing
  path: Path
}

export interface Neighbourhood {
  /** Latent, unasserted. Oxblood in the UI — "something the app noticed and
   *  you haven't." Never includes anything already connected by a path. */
  near: NearThing[]
  /** Paths you actually walked, with the why you wrote. */
  connected: ConnectedThing[]
}

function otherEnd(path: Path, thingId: string): string | null {
  if (path.fromId === thingId) return path.toId
  if (path.toId === thingId) return path.fromId
  return null
}

/**
 * The neighbourhood of one thing. Pure and synchronous — `vectorsById` is
 * whatever the caller already holds (peeked from cache, or filled in by the
 * background indexer), so this never loads the model and an empty map simply
 * means no mycorrhiza is proposed.
 */
export function computeNeighbourhood(
  thing: Thing,
  things: Thing[],
  vectorsById: Map<string, Float32Array>,
  paths: Path[],
  { limit = NEIGHBOURHOOD_LIMIT }: { limit?: number } = {},
): Neighbourhood {
  const byId = new Map(things.map((t) => [t.id, t]))

  const connected: ConnectedThing[] = []
  const connectedIds = new Set<string>()
  for (const path of paths) {
    const otherId = otherEnd(path, thing.id)
    if (!otherId) continue
    connectedIds.add(otherId)
    const other = byId.get(otherId)
    if (other) connected.push({ thing: other, path })
  }

  const self = vectorsById.get(thing.id)
  const near: NearThing[] = []
  if (self) {
    for (const candidate of things) {
      if (candidate.id === thing.id) continue
      if (candidate.state !== 'Kept') continue
      // Already asserted isn't latent — that belongs in `connected`.
      if (connectedIds.has(candidate.id)) continue
      const vector = vectorsById.get(candidate.id)
      if (!vector) continue
      const similarity = cosineSimilarity(self, vector)
      if (similarity < MYCORRHIZA_THRESHOLD) continue
      near.push({ thing: candidate, similarity })
    }
    near.sort((a, b) => b.similarity - a.similarity)
  }

  return { near: near.slice(0, limit), connected }
}

export interface EgoNode {
  id: string
  x: number
  y: number
  /** 'self' is the thing being read; the rest are its neighbours. */
  role: 'self' | 'near' | 'connected'
}

export const EGO_SIZE = 200
const EGO_CENTER = EGO_SIZE / 2
const EGO_RADIUS = 70
const EGO_PADDING = 22

/**
 * Centre plus one ring — the whole layout, and it is correct for every input
 * because the neighbourhood is bounded. This is the part that replaces
 * force-directed physics: there is nothing to simulate when you only ever draw
 * a handful of nodes around one.
 */
export function layoutEgoGraph(neighbourhood: Neighbourhood): EgoNode[] {
  const ring = [
    ...neighbourhood.connected.map((c) => ({ id: c.thing.id, role: 'connected' as const })),
    ...neighbourhood.near.map((n) => ({ id: n.thing.id, role: 'near' as const })),
  ]

  const nodes: EgoNode[] = [{ id: 'self', x: EGO_CENTER, y: EGO_CENTER, role: 'self' }]
  ring.forEach((node, i) => {
    // Start at twelve o'clock so a single neighbour sits above the centre
    // rather than beside it, which reads as a pair rather than a centre.
    const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2
    nodes.push({
      ...node,
      x: EGO_CENTER + EGO_RADIUS * Math.cos(angle),
      y: EGO_CENTER + EGO_RADIUS * Math.sin(angle),
    })
  })
  return nodes
}


export interface EgoViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * A box drawn tight around the nodes rather than the notional canvas. With one
 * or two neighbours the fixed 200×200 square is mostly empty, and the graph
 * reads as though something failed to load; cropping to the content makes a
 * small neighbourhood look deliberate, which it is.
 */
export function egoViewBox(nodes: EgoNode[]): EgoViewBox {
  if (nodes.length === 0) return { minX: 0, minY: 0, width: EGO_SIZE, height: EGO_SIZE }

  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const minX = Math.min(...xs) - EGO_PADDING
  const maxX = Math.max(...xs) + EGO_PADDING
  const minY = Math.min(...ys) - EGO_PADDING
  const maxY = Math.max(...ys) + EGO_PADDING

  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
