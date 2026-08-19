/**
 * The Underground graph layout — a hand-rolled, deterministic layout, not
 * force-directed physics (SILVA.md: "this is the graph layer, and it
 * exists from v1 because loci give it a stable node set"). Loci clusters
 * are arranged on a ring; each cluster's members sit in a smaller ring
 * around its center. No new dependency (no d3-force) — "exists from v1"
 * doesn't require a real physics engine, and a proper one is a real
 * possible future refinement.
 */

import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'
import { cosineSimilarity } from './embeddings'

export const CANVAS_SIZE = 600
const CENTER = CANVAS_SIZE / 2
const CLUSTER_RING_RADIUS = 210
const NODE_RING_MIN_RADIUS = 28
const NODE_RING_PER_MEMBER = 5
const NODE_RING_MAX_RADIUS = 90

export interface GraphNode {
  thing: Thing
  x: number
  y: number
  clusterId: string
}

export interface GraphCluster {
  id: string
  /** The locus name, or 'Unclustered' for things in no locus. */
  label: string
  x: number
  y: number
}

export interface GraphEdge {
  fromId: string
  toId: string
}

export interface GraphLayout {
  clusters: GraphCluster[]
  nodes: GraphNode[]
}

const UNCLUSTERED = 'unclustered'

/**
 * Groups Kept things into locus clusters (a thing in several loci clusters
 * under its *first* locus id — simplest tie-break, stated plainly rather
 * than hidden) plus one 'Unclustered' bucket, then arranges clusters on a
 * ring and each cluster's members on a smaller ring around it.
 */
export function computeGraphLayout(things: Thing[], loci: Locus[]): GraphLayout {
  const kept = things.filter((t) => t.state === 'Kept')

  const membersByCluster = new Map<string, Thing[]>()
  for (const thing of kept) {
    const clusterId = thing.lociIds[0] ?? UNCLUSTERED
    const list = membersByCluster.get(clusterId) ?? []
    list.push(thing)
    membersByCluster.set(clusterId, list)
  }

  const clusterIds = [...membersByCluster.keys()]
  const lociById = new Map(loci.map((l) => [l.id, l]))

  const clusters: GraphCluster[] = clusterIds.map((id, i) => {
    const angle = clusterIds.length > 1 ? (2 * Math.PI * i) / clusterIds.length : 0
    const radius = clusterIds.length > 1 ? CLUSTER_RING_RADIUS : 0
    return {
      id,
      label: id === UNCLUSTERED ? 'Unclustered' : (lociById.get(id)?.name ?? 'Unclustered'),
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
    }
  })
  const clusterById = new Map(clusters.map((c) => [c.id, c]))

  const nodes: GraphNode[] = []
  for (const [clusterId, members] of membersByCluster) {
    const cluster = clusterById.get(clusterId)!
    const nodeRadius = members.length <= 1
      ? 0
      : Math.min(NODE_RING_MAX_RADIUS, NODE_RING_MIN_RADIUS + members.length * NODE_RING_PER_MEMBER)
    members.forEach((thing, i) => {
      const angle = (2 * Math.PI * i) / members.length
      nodes.push({
        thing,
        clusterId,
        x: cluster.x + nodeRadius * Math.cos(angle),
        y: cluster.y + nodeRadius * Math.sin(angle),
      })
    })
  }

  return { clusters, nodes }
}

const VIEWBOX_PADDING = 40
const CLUSTER_LABEL_RISE = 70
const MIN_VIEWBOX_SIZE = 220

export interface ViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * A tight bounding box around the actual layout (nodes plus cluster labels,
 * which sit above their cluster), padded and floored to a minimum size —
 * so a handful of things doesn't render as a few dots lost in a fixed
 * 600×600 canvas. Falls back to the full canvas when the layout is empty.
 */
export function computeViewBox(layout: GraphLayout): ViewBox {
  if (layout.nodes.length === 0) {
    return { minX: 0, minY: 0, width: CANVAS_SIZE, height: CANVAS_SIZE }
  }

  const xs = layout.nodes.map((n) => n.x)
  const ys = layout.nodes.map((n) => n.y)
  if (layout.clusters.length > 1) {
    for (const c of layout.clusters) {
      xs.push(c.x)
      ys.push(c.y - CLUSTER_LABEL_RISE)
    }
  }

  const minX = Math.min(...xs) - VIEWBOX_PADDING
  const maxX = Math.max(...xs) + VIEWBOX_PADDING
  const minY = Math.min(...ys) - VIEWBOX_PADDING
  const maxY = Math.max(...ys) + VIEWBOX_PADDING

  const width = Math.max(MIN_VIEWBOX_SIZE, maxX - minX)
  const height = Math.max(MIN_VIEWBOX_SIZE, maxY - minY)
  // Center the floored minimum size on the content rather than anchoring
  // to its top-left corner.
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return { minX: centerX - width / 2, minY: centerY - height / 2, width, height }
}

export function pathsToEdges(paths: Path[]): GraphEdge[] {
  return paths
    .filter((p): p is Path & { fromId: string; toId: string } => Boolean(p.fromId && p.toId))
    .map((p) => ({ fromId: p.fromId, toId: p.toId }))
}

// Same bar as provocations.ts's NEAR_NEIGHBOUR_THRESHOLD — a graph fiber
// and a Near-neighbours provocation are the same underlying relationship,
// just shown in two different places.
export const MYCORRHIZA_THRESHOLD = 0.55

function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('::')
}

export interface MycorrhizaFiber {
  aId: string
  bId: string
  similarity: number
}

/** Faint, unclickable connections above the similarity threshold — never
 *  for a pair already connected by a real Path (that's not latent, it's
 *  already asserted). Only ever computed from vectors the caller already
 *  has in hand (peeked from cache) — this module never touches the model. */
export function computeMycorrhiza(
  things: Thing[],
  vectorsById: Map<string, Float32Array>,
  paths: Path[],
): MycorrhizaFiber[] {
  const kept = things.filter((t) => t.state === 'Kept' && vectorsById.has(t.id))
  const connected = new Set(
    paths.filter((p) => p.fromId && p.toId).map((p) => pairKey(p.fromId!, p.toId!)),
  )

  const fibers: MycorrhizaFiber[] = []
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i]
      const b = kept[j]
      if (connected.has(pairKey(a.id, b.id))) continue
      const similarity = cosineSimilarity(vectorsById.get(a.id)!, vectorsById.get(b.id)!)
      if (similarity < MYCORRHIZA_THRESHOLD) continue
      fibers.push({ aId: a.id, bId: b.id, similarity })
    }
  }
  return fibers
}
